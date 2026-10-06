"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { EnfermariaLocal, EnfermariaRecord } from "@/lib/enfermaria";
import styles from "./enfermaria-visual.module.css";

type HistoryEntry = { action: string; user: string; at: string; details?: unknown };
type Form = Record<string, unknown>;
type FormSection = Record<string, unknown>;

const demandTypes = ["Ferimento", "Queda", "Mal-estar", "Picada de inseto", "Afogamento", "Queimadura", "Outros"];
const symptoms = ["Febre", "Náusea ou vômito", "Tontura", "Sangramento", "Falta de ar", "Dor"];
const urgencies = ["Perda de consciência", "Convulsão", "Sangramento intenso", "Dificuldade respiratória"];
const risks = ["Alteração de consciência", "Risco de queda", "Cardiovascular", "Doenças crônicas", "Gestação", "Saúde mental", "Alergias", "Trauma", "Suspeita de fratura", "Lesão cutânea"];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Não foi possível concluir.");
  return payload.data as T;
}

function isoLocalNow() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function EnfermariaRecordForm({ id, professional, canManage }: { id: number; professional: string; canManage: boolean }) {
  const [record, setRecord] = useState<EnfermariaRecord | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [locals, setLocals] = useState<EnfermariaLocal[]>([]);
  const [form, setForm] = useState<Form>({});
  const [occurredAt, setOccurredAt] = useState(isoLocalNow());
  const [localId, setLocalId] = useState("");
  const [professionalName, setProfessionalName] = useState(professional);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [savedLabel, setSavedLabel] = useState("Carregando ficha…");
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [observationOpen, setObservationOpen] = useState(false);
  const [observation, setObservation] = useState("");

  const endpoint = `/api/painel/enfermaria/${id}`;
  const isLocked = record?.status === "encerrado" && !record.editUnlocked;

  const reload = useCallback(async () => {
    const [data, placeList] = await Promise.all([
      api<{ record: EnfermariaRecord; history: HistoryEntry[] }>(endpoint),
      api<EnfermariaLocal[]>("/api/painel/enfermaria?action=locals"),
    ]);
    setRecord(data.record); setHistory(data.history); setLocals(placeList);
    setForm(data.record.form ?? {});
    setDirty(false);
    setOccurredAt(data.record.occurredAt.replace(" ", "T"));
    setLocalId(data.record.localId ? String(data.record.localId) : "");
    setProfessionalName(data.record.professional || professional);
    setSavedLabel(data.record.status === "encerrado" ? "Ficha encerrada" : "Rascunho salvo");
  }, [endpoint, professional]);

  useEffect(() => { void reload().catch((e) => setError(e instanceof Error ? e.message : "Falha ao abrir ficha.")); }, [reload]);

  const getSection = (key: string): FormSection => {
    const value = form[key];
    return value && typeof value === "object" && !Array.isArray(value) ? value as FormSection : {};
  };
  const update = (section: string, key: string, value: unknown) => {
    setDirty(true);
    setForm((current: Form) => section
      ? ({ ...current, [section]: { ...((current[section] as FormSection | undefined) ?? {}), [key]: value } })
      : ({ ...current, [key]: value }));
    setSavedLabel("Salvando rascunho…");
  };
  const toggle = (section: string, key: string, value: string) => {
    const stored = getSection(section)[key];
    const current: string[] = Array.isArray(stored) ? stored as string[] : [];
    update(section, key, current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const save = useCallback(async () => {
    if (!record || isLocked || !dirty) return;
    setBusy(true);
    try {
      await api(endpoint, { method: "PATCH", body: JSON.stringify({ form, occurredAt: new Date(occurredAt).toISOString(), professional: professionalName, localId: localId ? Number(localId) : null }) });
      setSavedLabel(`Rascunho salvo às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`);
      setDirty(false);
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao salvar rascunho."); }
    finally { setBusy(false); }
  }, [dirty, endpoint, form, isLocked, localId, occurredAt, professionalName, record]);

  useEffect(() => {
    if (!record || isLocked || !dirty) return;
    const timer = window.setTimeout(() => { void save(); }, 900);
    return () => window.clearTimeout(timer);
  }, [form, occurredAt, localId, professionalName, isLocked, record, dirty, save]);

  async function action(name: string, payload: Record<string, unknown> = {}) {
    setBusy(true); setError("");
    try { await api(endpoint, { method: "POST", body: JSON.stringify({ action: name, ...payload }) }); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível concluir."); }
    finally { setBusy(false); }
  }

  async function closeOrRefreeze() {
    if (!window.confirm(record?.status === "encerrado" ? "Concluir correção e bloquear a ficha novamente?" : "Encerrar atendimento? A ficha será bloqueada.")) return;
    setBusy(true); setError("");
    try {
      if (dirty && (record?.status === "aberto" || record?.editUnlocked)) {
        await api(endpoint, { method: "PATCH", body: JSON.stringify({ form, occurredAt: new Date(occurredAt).toISOString(), professional: professionalName, localId: localId ? Number(localId) : null }) });
      }
      await api(endpoint, { method: "POST", body: JSON.stringify({ action: "close" }) });
      await reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível encerrar a ficha."); }
    finally { setBusy(false); }
  }

  const birthDate = String(getSection("identification").birthDate ?? "");
  const birth = birthDate ? new Date(`${birthDate}T12:00:00`) : null;
  const now = new Date();
  let ageInYears = birth && !Number.isNaN(birth.getTime()) ? now.getFullYear() - birth.getFullYear() : -1;
  if (birth && (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate()))) ageInYears--;
  const age = ageInYears >= 0 ? `${ageInYears} anos` : "";

  const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
  const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#176b96]";
  const disabled = Boolean(isLocked || busy);
  const field = (label: string, section: string, key: string, type = "text", extra?: { placeholder?: string; min?: string; max?: string }) => <label className="block text-sm font-medium text-slate-700">{label}<input className={input} type={type} value={String(getSection(section)[key] ?? "")} min={extra?.min} max={extra?.max} placeholder={extra?.placeholder} disabled={disabled} onChange={(e) => update(section, key, e.target.value)} /></label>;
  const textarea = (label: string, section: string, key: string) => <label className="block text-sm font-medium text-slate-700">{label}<textarea className={`${input} min-h-24 resize-y`} value={String(getSection(section)[key] ?? "")} disabled={disabled} onChange={(e) => update(section, key, e.target.value)} /></label>;
  const checks = (section: string, key: string, options: string[]) => <div className="mt-3 grid gap-2 sm:grid-cols-2">{options.map((value) => <label key={value} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" checked={Array.isArray(getSection(section)[key]) && (getSection(section)[key] as string[]).includes(value)} disabled={disabled} onChange={() => toggle(section, key, value)} />{value}</label>)}</div>;
  const yesNo = (label: string, section: string, key: string) => <label className="block text-sm font-medium text-slate-700">{label}<select className={input} value={(section ? getSection(section)[key] : form[key]) ? "sim" : "nao"} disabled={disabled} onChange={(e) => update(section, key, e.target.value === "sim")}><option value="nao">Não</option><option value="sim">Sim</option></select></label>;

  if (!record) return <div className="p-8 text-slate-600">{error || "Carregando ficha…"}</div>;
  const intakeMeta = getSection("unregisteredDetails");

  return <div className={`${styles.page} ${styles.workflowPage} grid gap-5 pb-7 print:max-w-none`}>
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-slate-500">Enfermaria / Atendimento nº {record.numberLabel}</p><h1 className="mt-1 text-3xl font-semibold text-[#194d6b]">Ficha de atendimento</h1><p className="mt-2 text-sm text-slate-600">{record.source === "sem_cadastro" ? "Sem cadastro" : record.source === "day_use" ? `Day use · Compra #${record.purchaseId}` : `Cliente #${record.clientId} · Passeio #${record.tripId}`}</p></div><div className="flex flex-wrap items-center gap-2 print:hidden"><Link className="rounded-lg border border-slate-300 px-4 py-2 text-sm" href="/painel/enfermaria">Painel</Link><Link className="rounded-lg border border-slate-300 px-4 py-2 text-sm" href="/painel/enfermaria/historico">Histórico</Link><button className="rounded-lg border border-slate-300 px-4 py-2 text-sm" onClick={() => window.print()}>Imprimir ficha</button></div></header>
    {isLocked && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Ficha encerrada e bloqueada. {canManage ? <button className="ml-2 underline" onClick={() => setUnlockOpen(true)}>Liberar edição</button> : "Um gerente precisa liberar a edição para corrigir dados."}</div>}
    {!isLocked && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{savedLabel}</div>}
    {record.source === "day_use" && <div className={card}><h2 className="font-semibold text-slate-800">Compra de day use</h2><p className="mt-1 text-sm text-slate-600">Comprador: {String((form.context as Record<string, unknown> | undefined)?.buyerName ?? "—")} · CPF {record.buyerCpf ?? "—"} · Compra #{record.purchaseId} · Visita {String((form.context as Record<string, unknown> | undefined)?.visitDate ?? "—")} · {String((form.context as Record<string, unknown> | undefined)?.ticketCount ?? 0)} ingresso(s)</p><p className="mt-1 text-xs text-slate-500">Ingressos: {String((form.context as Record<string, unknown> | undefined)?.ticketSummary ?? "—")}</p></div>}
    {record.source === "sem_cadastro" && <div className={card}><h2 className="font-semibold text-slate-800">Registro sem cadastro</h2><p className="mt-1 text-sm text-slate-600">{String(intakeMeta.intakeSource ?? "Origem não informada")} · CPF {String(intakeMeta.guardianCpf ?? "não informado")} · Telefone {String(intakeMeta.guardianPhone ?? "não informado")}</p>{Boolean(intakeMeta.noAccountReason) && <p className="mt-1 text-sm text-slate-600">Motivo: {String(intakeMeta.noAccountReason)}</p>}</div>}
    <section className={card}><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-800">Atendimento</h2><span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">{record.status === "aberto" ? "Em aberto" : "Encerrado"}</span></div><div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-medium text-slate-700">Data e horário<input className={input} type="datetime-local" value={occurredAt} disabled={disabled} onChange={(e) => { setDirty(true); setOccurredAt(e.target.value); setSavedLabel("Salvando rascunho…"); }} /></label><label className="text-sm font-medium text-slate-700">Profissional<input className={`${input} bg-slate-50`} value={professionalName} readOnly /></label><label className="text-sm font-medium text-slate-700">Local da ocorrência<select className={input} value={localId} disabled={disabled} onChange={(e) => { setDirty(true); setLocalId(e.target.value); setSavedLabel("Salvando rascunho…"); }}><option value="">Selecione um local</option>{locals.filter((v) => v.active || v.id === record.localId).map((place) => <option key={place.id} value={place.id}>{place.name}{!place.active ? " (desativado)" : ""}</option>)}</select><Link className="mt-2 inline-block text-xs font-semibold text-[#176b96]" href="/painel/enfermaria/locais">Cadastrar local</Link></label></div></section>
    <section className={card}><h2 className="text-lg font-semibold text-slate-800"><span className={styles.sectionNumber}>1</span>Identificação da pessoa atendida</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{field("Nome", "identification", "name")}{field("CPF", "identification", "cpf")}{field("Data de nascimento", "identification", "birthDate", "date")}<div><label className="block text-sm font-medium text-slate-700">Idade calculada<input className={`${input} bg-slate-50`} readOnly value={age} /></label></div><label className="text-sm font-medium text-slate-700">Sexo<select className={input} value={String(getSection("identification").sex ?? "")} disabled={disabled} onChange={(e) => update("identification", "sex", e.target.value)}><option value="">Selecione</option><option>Feminino</option><option>Masculino</option><option>Outro</option><option>Não informado</option></select></label>{field("Telefone (opcional)", "identification", "phone")}{field("Acompanhante (opcional)", "identification", "companion")}{field("Parentesco (opcional)", "identification", "relationship")}</div></section>
    <section className={card}><h2 className="text-lg font-semibold text-slate-800"><span className={styles.sectionNumber}>2</span>Queixa principal e demanda</h2><div className="mt-4 grid gap-4">{textarea("Queixa principal", "complaint", "text")}<fieldset><legend className="text-sm font-medium text-slate-700">Tipo de demanda</legend>{checks("complaint", "demandTypes", demandTypes)}</fieldset></div></section>
    <section className={card}><h2 className="text-lg font-semibold text-slate-800"><span className={styles.sectionNumber}>3</span>Sinais e sintomas</h2><fieldset className="mt-3"><legend className="text-sm font-medium text-slate-700">Marque os sinais e sintomas</legend>{checks("symptoms", "items", symptoms)}</fieldset><div className="mt-4 grid gap-4 sm:grid-cols-2">{field("Localização da dor", "symptoms", "painLocation")}{field("Intensidade da dor (0 a 10)", "symptoms", "painIntensity", "number", { min: "0", max: "10" })}</div></section>
    <section className={card}><h2 className="text-lg font-semibold text-slate-800"><span className={styles.sectionNumber}>4</span>Sinais vitais</h2><div className="mt-4 grid gap-4 sm:grid-cols-3">{field("PA (mmHg)", "vitals", "bloodPressure")}{field("FC (bpm)", "vitals", "heartRate", "number")}{field("FR (irpm)", "vitals", "respiratoryRate", "number")}{field("SpO₂ (%)", "vitals", "oxygenSaturation", "number")}{field("Temperatura (°C)", "vitals", "temperature", "number")}{field("Glicemia (mg/dL)", "vitals", "glucose", "number")}{field("Dor (0 a 10)", "vitals", "pain", "number", { min: "0", max: "10" })}{field("Horário da aferição", "vitals", "measuredAt", "time")}</div></section>
    <section className={card}><h2 className="text-lg font-semibold text-slate-800"><span className={styles.sectionNumber}>5</span>Urgência e emergência</h2><div className="mt-4 max-w-sm">{yesNo("Houve urgência ou emergência?", "", "urgent")}</div>{form.urgent === true && <><fieldset className="mt-4"><legend className="text-sm font-medium text-slate-700">Sinais de alerta</legend>{checks("urgency", "items", urgencies)}</fieldset><div className="mt-4">{textarea("Conduta adotada", "urgency", "conduct")}</div></>}</section>
    <section className={card}><h2 className="text-lg font-semibold text-slate-800"><span className={styles.sectionNumber}>6</span>Estratificação de risco</h2>{checks("risk", "items", risks)}</section>
    <section className={card}><h2 className="text-lg font-semibold text-slate-800"><span className={styles.sectionNumber}>7</span>Encaminhamento para UPA</h2><div className="mt-4 max-w-sm">{yesNo("A pessoa foi encaminhada?", "", "referralToUpa")}</div>{form.referralToUpa === true && <div className="mt-4 grid gap-4 sm:grid-cols-2">{field("Motivo", "referral", "reason")}<label className="text-sm font-medium text-slate-700">Forma<select className={input} value={String(getSection("referral").method ?? "")} disabled={disabled} onChange={(e) => update("referral", "method", e.target.value)}><option value="">Selecione</option>{["SAMU", "Ambulância", "Veículo próprio", "Veículo do Rincão"].map((option) => <option key={option}>{option}</option>)}</select></label>{field("Horário", "referral", "time", "time")}{field("Unidade de destino", "referral", "destination")}</div>}</section>
    <section className={card}><h2 className="text-lg font-semibold text-slate-800"><span className={styles.sectionNumber}>8</span>Relatório do enfermeiro</h2>{textarea("Relatório", "reports", "nurse")}</section>
    <section className={card}><h2 className="text-lg font-semibold text-slate-800"><span className={styles.sectionNumber}>9</span>Relatório do técnico de enfermagem</h2>{textarea("Relatório", "reports", "technician")}</section>
    <section className={card}><h2 className="text-lg font-semibold text-slate-800"><span className={styles.sectionNumber}>10</span>Observações complementares</h2>{textarea("Observações", "reports", "additional")}</section>
    <section className={`${card} print:break-inside-avoid`}><h2 className="text-lg font-semibold text-slate-800">Responsável pelo atendimento</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{field("Nome", "responsible", "name")}{field("COREN", "responsible", "coren")}</div><p className="mt-3 text-xs text-slate-500">A assinatura e o carimbo são preenchidos na ficha impressa.</p></section>
    <section className={`${card} print:hidden`}><h2 className="text-lg font-semibold text-slate-800">Vínculo</h2><p className="mt-2 text-sm text-slate-600">{record.clientId ? `Cliente #${record.clientId}` : record.purchaseId ? `Day use · Compra #${record.purchaseId} · CPF ${record.buyerCpf ?? ""}` : "Sem cadastro"}</p>{record.clientId && <Link className="mt-3 inline-block text-sm font-semibold text-[#176b96]" href={`/painel/enfermaria/clientes/${record.clientId}`}>Atendimentos deste cliente</Link>}
      {record.status === "encerrado" && record.clientId && canManage && <button className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm" onClick={() => { setObservation(`Passou pela enfermaria em ${new Date().toLocaleDateString("pt-BR")}.`); setObservationOpen(true); }}>Adicionar observação neutra ao cliente</button>}
      {record.status === "encerrado" && <button disabled className="ml-2 mt-4 cursor-not-allowed rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-400" title="Canal de mensagem ainda não definido">Enviar mensagem ao cliente (canal a definir)</button>}
      {record.source === "sem_cadastro" && !record.clientId && canManage && <Link className="ml-2 mt-4 inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm" href={`/painel/enfermaria/vincular/${record.id}`}>Vincular a um cliente</Link>}
      <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-slate-700">Histórico da ficha</summary><ul className="mt-3 grid gap-2">{history.map((item, index) => <li key={`${item.at}-${index}`} className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{item.action.replaceAll("_", " ")} · {item.user} · {new Date(item.at).toLocaleString("pt-BR")}</li>)}</ul></details>
    </section>
    {!isLocked && <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur print:hidden"><span className="text-sm text-slate-500">{savedLabel}</span><div className="flex gap-2"><button className="rounded-lg border border-slate-300 px-4 py-2 text-sm" disabled={busy} onClick={() => void save()}>Salvar rascunho</button>{(record.status === "aberto" || record.editUnlocked) && <button className="rounded-lg bg-[#176b96] px-4 py-2 text-sm font-semibold text-white" disabled={busy} onClick={() => void closeOrRefreeze()}>{record.status === "encerrado" ? "Concluir correção e bloquear ficha" : "Encerrar atendimento"}</button>}</div></div>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 print:hidden">{error}</p>}
    {unlockOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 print:hidden"><form className="w-full max-w-md rounded-2xl bg-white p-6" onSubmit={(e) => { e.preventDefault(); void action("unlock", { password: adminPassword }).then(() => setUnlockOpen(false)); }}><h2 className="text-lg font-semibold">Liberar edição da ficha</h2><p className="mt-2 text-sm text-slate-600">Informe a senha do gerente autenticado. A liberação será registrada no histórico.</p><label className="mt-4 block text-sm">Senha de gerente<input className={input} autoFocus type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} /></label><div className="mt-5 flex justify-end gap-2"><button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setUnlockOpen(false)}>Cancelar</button><button className="rounded-lg bg-[#176b96] px-4 py-2 text-sm font-semibold text-white">Liberar edição</button></div></form></div>}
    {observationOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 print:hidden"><form className="w-full max-w-md rounded-2xl bg-white p-6" onSubmit={(e) => { e.preventDefault(); void action("observation", { text: observation }).then(() => { setObservationOpen(false); setObservation(""); }); }}><h2 className="text-lg font-semibold">Adicionar observação ao cliente</h2><p className="mt-2 text-sm text-amber-800">Outros perfis veem esta observação. Use apenas um texto neutro e padrão.</p><textarea className={`${input} mt-4 min-h-24`} value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="Passou pela enfermaria em 05/10/2026." /><div className="mt-5 flex justify-end gap-2"><button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setObservationOpen(false)}>Cancelar</button><button className="rounded-lg bg-[#176b96] px-4 py-2 text-sm font-semibold text-white">Adicionar observação</button></div></form></div>}
    <div className="hidden print:block"><div className="mt-12 grid grid-cols-2 gap-12 text-center"><div className="border-t border-slate-700 pt-2">{String(getSection("responsible").name ?? "Responsável")}<br />COREN {String(getSection("responsible").coren ?? "")}</div><div className="border-t border-slate-700 pt-2">Assinatura e carimbo</div></div></div>
  </div>;
}
