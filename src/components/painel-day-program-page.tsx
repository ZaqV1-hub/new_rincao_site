"use client";

import Link from "next/link";
import { useEffect, useReducer, useRef, useState, type FormEvent, type MouseEvent } from "react";
import type { DayProgram, DayProgramGroup, DayProgramGroupInput, DayProgramInput } from "@/lib/day-program";
import type { DayProgramNavigation } from "@/lib/day-program-navigation";

const button = "inline-flex min-h-11 items-center justify-center rounded-lg border border-[#b8cbdc] bg-white px-3 py-2 text-sm font-semibold hover:bg-[#edf4fa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#236699] disabled:cursor-not-allowed disabled:opacity-50";
const input = "min-h-11 w-full min-w-0 rounded-lg border border-[#b8cbdc] bg-white px-3 py-2 text-base text-[#123b63] placeholder:text-[#45647f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#236699] disabled:bg-[#f4f8fc]";
const panel = "min-w-0 rounded-xl border border-[#d4dfeb] bg-white p-4 sm:p-6";
const statuses: Record<DayProgram["status"], string> = { uncreated: "A criar", created: "Criado", exported: "Criado e enviado · arquivos gerados", past_created: "Já ocorreu", past_uncreated: "Já ocorreu e não criado" };
const sourceLabels = { client: "Cadastro do cliente", contract: "Contrato do passeio", operational: "Programação do passeio" };
const groupKey = (group: Pick<DayProgramGroup, "agendaId" | "clientId">) => `group:${group.agendaId}:${group.clientId}`;
const shortDate = (date: string) => date.split("-").reverse().join("/");
const quantity = (value: number | null) => value === null ? "A preencher" : value.toLocaleString("pt-BR");

type Patch = Pick<DayProgramInput, "groups" | "hiringItems" | "observations">;
type Phase = "idle" | "saving" | "creating" | "exporting" | "loading" | "refreshing" | "blocked";
export type ProgramEditorState = { program: DayProgram; pending: Record<string, { sequence: number; patch: Patch }>; sequence: number; phase: Phase; error: string | null };
type Action = { type: "edit"; key: string; patch: Patch } | { type: "phase"; phase: Phase } | { type: "failed"; message: string } | { type: "accepted"; program: DayProgram; sequence: number } | { type: "loaded"; program: DayProgram };
export function createProgramEditorState(program: DayProgram): ProgramEditorState { return { program, pending: {}, sequence: 0, phase: "idle", error: null }; }
export function programEditorReducer(state: ProgramEditorState, action: Action): ProgramEditorState {
  switch (action.type) {
    case "edit": return { ...state, sequence: state.sequence + 1, pending: { ...state.pending, [action.key]: { sequence: state.sequence + 1, patch: action.patch } } };
    case "phase": return { ...state, phase: action.phase, error: action.phase === "loading" ? state.error : null };
    case "failed": return { ...state, phase: "blocked", error: action.message };
    case "accepted": return { ...state, program: action.program, pending: Object.fromEntries(Object.entries(state.pending).filter(([, edit]) => edit.sequence > action.sequence)), phase: "idle", error: null };
    case "loaded": return createProgramEditorState(action.program);
  }
}
export function programPendingPayload(state: ProgramEditorState): Patch {
  const patches = Object.values(state.pending).map((entry) => entry.patch);
  return { ...(patches.some((p) => p.groups) ? { groups: patches.flatMap((p) => p.groups ?? []) } : {}),
    ...(patches.some((p) => p.hiringItems) ? { hiringItems: patches.flatMap((p) => p.hiringItems ?? []) } : {}),
    ...(state.pending.observations ? { observations: state.pending.observations.patch.observations } : {}) };
}
async function responseProgram(response: Response, date: string): Promise<DayProgram> {
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) throw new Error(body?.error?.message || "Não foi possível confirmar a gravação. Consulte a versão do servidor antes de continuar.");
  if (body.data?.date !== date || !Array.isArray(body.data.groups) || !Array.isArray(body.data.hiringItems) || typeof body.data.sourceFingerprint !== "string") throw new Error("Resposta incompleta do servidor. Consulte a versão atual antes de continuar.");
  return body.data;
}

export async function refreshProgramWeather(date: string): Promise<DayProgram> {
  const response = await fetch(`/api/painel/dias/${date}/previsao`, { method: "POST" });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) throw new Error(body?.error?.message || "Não foi possível atualizar a previsão. Consulte o servidor antes de continuar.");
  return responseProgram(await fetch(`/api/painel/dias/${date}/programacao`, { cache: "no-store" }), date);
}
function weatherTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

type EditableGroup = DayProgramGroup & Pick<DayProgramGroupInput, "carrier">;
function GroupEditor({ group, carriers, onSave, onClose }: { group: EditableGroup; carriers: DayProgram["carriers"]; onSave: (value: DayProgramGroupInput) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [transport, setTransport] = useState(group.carrier ? "new" : group.transportMode === "carrier" ? String(group.carrierId) : group.transportMode);
  const [error, setError] = useState<string | null>(null);
  const [carrierContact, setCarrierContact] = useState(group.carrierContact ?? "");
  const [carrierPhone, setCarrierPhone] = useState(group.carrierPhone ?? "");
  const carrier = carriers.find((item) => String(item.id) === transport);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => { element?.close(); }; }, []);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "").trim() || null;
    const count = (name: string) => text(name) === null ? null : Number(text(name));
    const buses = count("buses"), vans = count("vans");
    if ((buses === null) !== (vans === null)) { setError("Preencha ônibus e vans; use 0 quando não houver. Deixe ambos em branco se ainda não souber."); return; }
    if (transport === "new" && !text("carrierName")) { setError("Informe o nome do transportador."); return; }
    onSave({ agendaId: group.agendaId, clientId: group.clientId, contact: text("contact"), phone: text("phone"), plannedPeople: count("plannedPeople"), buses, vans,
      boardingTime: text("boardingTime"), observations: text("observations"), foodNotes: text("foodNotes"), transportMode: transport === "unset" || transport === "client" ? transport : "carrier",
      carrierId: carrier?.id ?? null, carrierContact: transport === "unset" || transport === "client" ? null : carrierContact.trim() || null, carrierPhone: transport === "unset" || transport === "client" ? null : carrierPhone.trim() || null, ...(transport === "new" ? { carrier: { name: text("carrierName")!, contact: text("carrierContact"), phone: text("carrierPhone") } } : {}) });
  }
  const field = (label: string, name: string, value: string | number | null, type = "text", maxLength?: number) => <label className="space-y-1 text-sm font-semibold"><span>{label}</span><input className={input} name={name} defaultValue={value ?? ""} type={type} min={type === "number" ? 0 : undefined} max={type === "number" ? name === "plannedPeople" ? 100000 : 100 : undefined} step={type === "number" ? 1 : undefined} maxLength={maxLength} placeholder="A preencher" /></label>;
  return <dialog ref={dialog} aria-labelledby="program-group-title" onCancel={onClose} className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto rounded-xl border border-[#d4dfeb] bg-white p-4 text-[#123b63] backdrop:bg-black/40 sm:p-6">
    <form onSubmit={submit} className="space-y-5">
      <div className="flex items-start justify-between gap-3"><h2 id="program-group-title" className="text-xl font-bold">{group.clientName}</h2><button type="button" className={button} onClick={onClose} aria-label="Fechar edição do grupo">Fechar</button></div>
      <dl className="space-y-2 text-sm text-[#45647f]"><div><dt className="font-semibold">Representante</dt><dd>{group.representative || "A preencher no contrato"}</dd></div><div><dt className="font-semibold">Endereço da escola</dt><dd>{group.address || "A preencher no cadastro do cliente"}</dd><dd>{group.origins.address && sourceLabels[group.origins.address]}</dd></div></dl>
      <div className="grid gap-4 sm:grid-cols-2">{field("Contato da escola", "contact", group.contact, "text", 160)}{field("Telefone da escola", "phone", group.phone, "tel", 40)}{field("Ônibus previstos", "buses", group.buses, "number")}{field("Vans previstas", "vans", group.vans, "number")}{field("Horário de embarque", "boardingTime", group.boardingTime, "time")}{field("Público previsto", "plannedPeople", group.plannedPeople, "number")}
        <label className="space-y-1 text-sm font-semibold sm:col-span-2"><span>Transportador</span><select className={input} value={transport} onChange={(event) => { const value = event.target.value; setTransport(value); const selected = carriers.find((item) => String(item.id) === value); setCarrierContact(selected?.contact ?? ""); setCarrierPhone(selected?.phone ?? ""); }}><option value="unset">A preencher</option><option value="client">Transporte do cliente</option>{carriers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}<option value="new">Cadastrar outro transportador</option></select></label>
        {transport === "new" && <><label className="space-y-1 text-sm font-semibold sm:col-span-2"><span>Nome do novo transportador</span><input className={input} name="carrierName" required maxLength={160} defaultValue={group.carrier?.name ?? ""} /></label></>}
        {(carrier || transport === "new") && <><label className="space-y-1 text-sm font-semibold"><span>Contato do transportador neste passeio</span><input className={input} name="carrierContact" maxLength={160} value={carrierContact} onChange={(event) => setCarrierContact(event.target.value)} /></label><label className="space-y-1 text-sm font-semibold"><span>Telefone do transportador neste passeio</span><input className={input} name="carrierPhone" type="tel" maxLength={40} value={carrierPhone} onChange={(event) => setCarrierPhone(event.target.value)} /></label><p className="text-sm text-[#45647f] sm:col-span-2">Contato e telefone ficam registrados neste passeio. O cadastro de transportadores existentes permanece igual.</p></>}
        <label className="space-y-1 text-sm font-semibold sm:col-span-2"><span>Observações do grupo</span><textarea className={input} name="observations" rows={3} maxLength={2000} defaultValue={group.observations ?? ""} /></label>
        <label className="space-y-1 text-sm font-semibold sm:col-span-2"><span>Restrições alimentares para a cozinha</span><textarea className={input} name="foodNotes" rows={3} maxLength={2000} defaultValue={group.foodNotes ?? ""} /></label>
      </div>
      <p className="text-sm text-[#45647f]">Veículos em branco continuam a preencher. Alterar quantidades preserva os veículos extras e as contagens iniciadas.</p>
      {error && <p role="alert" className="text-sm text-[#8b2d25]">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2"><button type="button" className={button} onClick={onClose}>Cancelar</button><button className={`${button} border-[#123b63] bg-[#123b63] text-white hover:bg-[#236699]`} type="submit">Aplicar alterações</button></div>
    </form>
  </dialog>;
}

export function PainelDayProgramPage({ program: initial, navigation, canManage, returnDate = initial.date }: { program: DayProgram; navigation: DayProgramNavigation; canManage: boolean; returnDate?: string }) {
  const [state, dispatch] = useReducer(programEditorReducer, initial, createProgramEditorState);
  const [pastReason, setPastReason] = useState("");
  const [allowPast, setAllowPast] = useState(false);
  const [showPastReason, setShowPastReason] = useState(false);
  const [editing, setEditing] = useState<EditableGroup | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const inFlight = useRef(false);
  const { program, pending, phase } = state;
  const dirty = Object.keys(pending).length > 0;
  const past = program.status === "past_created" || program.status === "past_uncreated";
  const writable = canManage && !program.closed && (!program.readOnly || allowPast);
  const editable = writable && program.version !== null && !["creating", "loading", "exporting", "refreshing"].includes(phase);
  const busy = ["creating", "saving", "loading", "exporting", "refreshing"].includes(phase);
  const canRefreshWeather = canManage && program.park === "rincao" && !program.closed && !program.readOnly && !past && !dirty && phase === "idle" && !editing && !addingItem;
  const endpoint = `/api/painel/dias/${program.date}/programacao`;
  const longDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${program.date}T12:00:00Z`));
  const groups = program.groups.map((group) => ({ ...group, ...pending[groupKey(group)]?.patch.groups?.[0] }));
  const hiring = program.hiringItems.map((item) => ({ ...item, value: pending[`hiring:${item.id}`] ? pending[`hiring:${item.id}`].patch.hiringItems![0].value : item.value, key: `hiring:${item.id}` }));
  for (const [key, edit] of Object.entries(pending)) {
    const item = edit.patch.hiringItems?.[0];
    if (item?.name) {
      const existing = hiring.find((entry) => entry.name.toLocaleLowerCase("pt-BR") === item.name!.toLocaleLowerCase("pt-BR"));
      if (existing) { existing.value = item.value; existing.key = key; }
      else hiring.push({ id: 0, name: item.name, value: item.value, key });
    }
  }
  const knownPeople = program.dayUseSold + groups.reduce((total, group) => total + (group.plannedPeople ?? 0), 0);
  const knownVehicles = groups.reduce((total, group) => total + (group.buses ?? 0) + (group.vans ?? 0) + group.extraBuses + group.extraVans, 0);
  const missingPeople = groups.some((group) => group.plannedPeople === null);
  const missingVehicles = groups.some((group) => group.buses === null || group.vans === null);
  const options = allowPast ? { allowPast: true, reason: pastReason.trim() } : {};
  function edit(key: string, patch: Patch) { setDownloadMessage(null); dispatch({ type: "edit", key, patch }); }
  useEffect(() => {
    if (!dirty && !editing && !addingItem) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, editing, addingItem]);
  useEffect(() => {
    if (!dirty || phase !== "idle" || !writable || program.version === null) return;
    const timer = window.setTimeout(() => {
      if (inFlight.current) return;
      inFlight.current = true;
      dispatch({ type: "phase", phase: "saving" });
      fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: program.version, ...programPendingPayload(state), ...(allowPast ? { allowPast: true, reason: pastReason.trim() } : {}) }) })
        .then((response) => responseProgram(response, program.date))
        .then((data) => dispatch({ type: "accepted", program: data, sequence: state.sequence }))
        .catch((error: unknown) => dispatch({ type: "failed", message: error instanceof Error ? error.message : "Não foi possível confirmar a gravação." }))
        .finally(() => { inFlight.current = false; });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [dirty, phase, writable, program.version, program.date, endpoint, state, allowPast, pastReason]);
  function leave(event: MouseEvent<HTMLAnchorElement>) {
    if (dirty && !window.confirm("Há alterações sem confirmação de salvamento. Sair descarta o rascunho desta tela. Deseja sair?")) event.preventDefault();
  }
  async function create() {
    if (inFlight.current) return;
    inFlight.current = true;
    dispatch({ type: "phase", phase: "creating" });
    try { const data = await responseProgram(await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(options) }), program.date); dispatch({ type: "accepted", program: data, sequence: state.sequence }); }
    catch (error) { dispatch({ type: "failed", message: error instanceof Error ? error.message : "Não foi possível confirmar a criação." }); }
    finally { inFlight.current = false; }
  }
  async function loadServer() {
    if (inFlight.current || !window.confirm("Carregar a versão do servidor e descartar todas as alterações locais desta tela?")) return;
    inFlight.current = true;
    dispatch({ type: "phase", phase: "loading" });
    try { const data = await responseProgram(await fetch(endpoint, { cache: "no-store" }), program.date); dispatch({ type: "loaded", program: data }); setEditing(null); setDownloadMessage(null); }
    catch (error) { dispatch({ type: "failed", message: error instanceof Error ? error.message : "Não foi possível consultar o servidor. Seu rascunho foi preservado." }); }
    finally { inFlight.current = false; }
  }
  async function refreshWeather() {
    if (inFlight.current || !canRefreshWeather) return;
    inFlight.current = true;
    setDownloadMessage(null);
    dispatch({ type: "phase", phase: "refreshing" });
    try { dispatch({ type: "accepted", program: await refreshProgramWeather(program.date), sequence: state.sequence }); }
    catch (error) { dispatch({ type: "failed", message: error instanceof Error ? error.message : "Não foi possível confirmar a atualização da previsão. Seu rascunho foi preservado." }); }
    finally { inFlight.current = false; }
  }
  async function download() {
    if (inFlight.current || dirty || phase !== "idle") return;
    inFlight.current = true;
    dispatch({ type: "phase", phase: "exporting" });
    try {
      const response = await fetch(`${endpoint}/export`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: program.version, sourceFingerprint: program.sourceFingerprint, ...options }) });
      if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error?.message || "Não foi possível gerar os arquivos. Consulte a versão do servidor antes de tentar novamente."); }
      if (!response.headers.get("Content-Type")?.includes("application/zip")) throw new Error("O servidor não retornou o arquivo esperado. Consulte a programação antes de tentar novamente.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = `dia-seguinte-${program.date}.zip`; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setDownloadMessage("Arquivos gerados. O download reúne a programação e as fichas em PDF e imagens. O envio aos destinatários é manual.");
      const data = await responseProgram(await fetch(endpoint, { cache: "no-store" }), program.date);
      dispatch({ type: "accepted", program: data, sequence: state.sequence });
    } catch (error) { dispatch({ type: "failed", message: error instanceof Error ? error.message : "Não foi possível confirmar a geração dos arquivos. Consulte o servidor antes de tentar novamente." }); }
    finally { inFlight.current = false; }
  }
  const dayHref = (date: string) => `/painel/agenda/${date}/dia-seguinte?returnTo=${returnDate}`;
  const observationValue = pending.observations ? pending.observations.patch.observations ?? "" : program.observations ?? "";
  return <div className="mx-auto w-full min-w-0 max-w-[1120px] space-y-6 text-[#123b63] [overflow-wrap:anywhere] selection:bg-[#d4e7f6]">
    <header className={`${panel} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2"><Link href={`/painel/agenda/${returnDate}`} onClick={leave} className={button} aria-label="Fechar dia seguinte e voltar para a data">Fechar e voltar à data</Link><nav aria-label="Datas com movimento" className="flex gap-2">{navigation.previousDate ? <Link href={dayHref(navigation.previousDate)} onClick={leave} className={button}>Anterior</Link> : <button className={button} disabled>Anterior</button>}{navigation.nextDate ? <Link href={dayHref(navigation.nextDate)} onClick={leave} className={button}>Próxima</Link> : <button className={button} disabled>Próxima</button>}</nav></div>
      <div><h1 className="text-2xl font-bold sm:text-3xl">Dia seguinte</h1><p className="mt-1 text-lg">{longDate}</p></div>
      <div className="flex flex-wrap items-center gap-3"><span className="rounded-md bg-[#edf4fa] px-3 py-2 text-sm font-semibold">{statuses[program.status]}</span>{program.closed && <span className="font-semibold">Dia finalizado · somente consulta</span>}<p role="status" aria-live="polite" className="text-sm text-[#45647f]">{phase === "saving" ? "Salvando alterações…" : phase === "creating" ? "Criando programação…" : phase === "exporting" ? "Gerando arquivos…" : phase === "refreshing" ? "Atualizando previsão…" : phase === "loading" ? "Consultando servidor…" : phase === "blocked" ? "Salvamento pausado. Rascunho preservado nesta tela." : dirty ? "Alterações aguardando salvamento…" : program.version === null ? "Crie a programação para começar a preencher." : state.sequence > 0 ? "Alterações salvas. As próximas alterações salvam automaticamente." : "Versão do servidor carregada. Alterações salvam automaticamente."}</p></div>
      <nav aria-label="Programações das datas com movimento" className="flex gap-2 overflow-x-auto pb-2">{navigation.dates.map((day) => <Link key={day.date} href={dayHref(day.date)} onClick={leave} aria-current={day.date === program.date ? "date" : undefined} className={`${button} shrink-0 flex-col items-start gap-1 ${day.date === program.date ? "border-[#236699] bg-[#edf4fa]" : ""}`}><span>{shortDate(day.date)}</span><span className="text-xs font-normal">{statuses[day.date === program.date ? program.status : day.status]}</span></Link>)}</nav>
      <div className="flex flex-wrap gap-3">{writable && program.version === null && <button type="button" className={button} disabled={busy || phase === "blocked"} onClick={create}>Criar dia seguinte</button>}{writable && program.version !== null && <button type="button" className={button} disabled={dirty || phase !== "idle" || editing !== null} onClick={download}>Gerar arquivos para envio</button>}</div>
      <p className="text-sm text-[#45647f]">O painel gera PDFs e imagens para download. Quem envia ao grupo e aos transportadores é o gerente.</p>
    </header>
    {state.error && <section className={`${panel} space-y-3 border-[#b86151]`} aria-label="Problema ao salvar"><p role="alert">{state.error}</p><p className="text-sm">Nenhuma tentativa será repetida automaticamente. Confira seu rascunho abaixo antes de carregar o servidor.</p><button type="button" className={button} disabled={busy} onClick={loadServer}>Carregar servidor e descartar rascunho</button></section>}
    {downloadMessage && <p role="status" className={panel}>{downloadMessage}</p>}
    {past && !program.closed && <section className={`${panel} space-y-3`}><p>{allowPast ? "Editando uma data que já ocorreu. O motivo acompanha as alterações registradas." : "Esta data já ocorreu. A programação está em modo de consulta."}</p>{canManage && !allowPast && (!showPastReason ? <button className={button} type="button" onClick={() => setShowPastReason(true)}>Editar mesmo assim</button> : <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (pastReason.trim()) setAllowPast(true); }}><label className="block space-y-1 text-sm font-semibold"><span>Motivo da edição</span><textarea className={input} required maxLength={1000} value={pastReason} onChange={(event) => setPastReason(event.target.value)} /></label><button className={button} type="submit">Autorizar edição com este motivo</button></form>)}</section>}
    {!canManage && <p className="text-sm text-[#45647f]">Seu perfil permite consultar a programação. Alterações e geração de arquivos são reservadas aos gerentes.</p>}
    <section className={`${panel} space-y-4`} aria-labelledby="program-groups-title"><div><h2 id="program-groups-title" className="text-lg font-bold">Grupos do dia</h2><p className="mt-1 text-sm text-[#45647f]">Os grupos vêm da agenda. Contato e endereço indicam sua origem; dados ausentes ficam a preencher.</p></div>
      {groups.length === 0 ? <p>Nenhum grupo nesta data.</p> : <ul className="divide-y divide-[#d4dfeb]">{groups.map((group) => { const carrier = program.carriers.find((item) => item.id === group.carrierId); return <li key={groupKey(group)} className="space-y-3 py-4 first:pt-0"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="min-w-0 text-lg font-semibold">{group.clientName}</h3>{editable && <button className={button} type="button" onClick={() => setEditing(group)}>Editar grupo<span className="sr-only"> {group.clientName}</span></button>}</div><dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div><dt className="text-[#45647f]">Representante</dt><dd>{group.representative || "A preencher"}</dd></div><div><dt className="text-[#45647f]">Contato da escola</dt><dd>{group.contact || "A preencher"} · {group.phone || "Telefone a preencher"}</dd><dd className="mt-1 text-xs text-[#45647f]">{pending[groupKey(group)] ? "Rascunho da programação" : group.origins.contact ? sourceLabels[group.origins.contact] : "Sem contato informado"}</dd></div><div><dt className="text-[#45647f]">Endereço da escola</dt><dd>{group.address || "A preencher no cadastro"}</dd><dd className="mt-1 text-xs text-[#45647f]">{group.origins.address && sourceLabels[group.origins.address]}</dd></div>
        <div><dt className="text-[#45647f]">Público previsto</dt><dd className="tabular-nums">{quantity(group.plannedPeople)}</dd></div><div><dt className="text-[#45647f]">Veículos previstos</dt><dd className="tabular-nums">Ônibus: {quantity(group.buses)} · Vans: {quantity(group.vans)}</dd>{(group.extraBuses > 0 || group.extraVans > 0) && <dd className="tabular-nums">Extras · Ônibus: {quantity(group.extraBuses)} · Vans: {quantity(group.extraVans)}</dd>}</div><div><dt className="text-[#45647f]">Transportador · embarque</dt><dd>{group.transportMode === "client" ? "Transporte do cliente" : group.carrier?.name || carrier?.name || "Transportador a preencher"}</dd><dd>{group.boardingTime || "Horário a preencher"}</dd>{group.transportMode === "carrier" && <dd>{group.carrierContact || "Contato a preencher"} · {group.carrierPhone || "Telefone a preencher"}</dd>}</div><div className="sm:col-span-2 lg:col-span-3"><dt className="text-[#45647f]">Observações</dt><dd className="whitespace-pre-wrap">{group.observations || "Sem observações"}</dd></div>
        {group.foodNotes && <div className="sm:col-span-2 lg:col-span-3"><dt className="text-[#45647f]">Restrições alimentares para a cozinha</dt><dd className="whitespace-pre-wrap">{group.foodNotes}</dd></div>}
      </dl></li>; })}</ul>}
      <dl className="space-y-3 border-t border-[#d4dfeb] pt-4"><div className="flex flex-wrap justify-between gap-2"><dt>Day use · público vendido para a data</dt><dd className="font-semibold tabular-nums">{quantity(program.dayUseSold)}</dd></div><div className="flex flex-wrap justify-between gap-2 font-semibold"><dt>Resumo do dia</dt><dd className="tabular-nums">{quantity(knownPeople)} pessoas{missingPeople ? " conhecidas · público a preencher" : " previstas"} · {quantity(knownVehicles)} veículos{missingVehicles ? " conhecidos · veículos a preencher" : ""}</dd></div></dl>
    </section>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"><section className={`${panel} space-y-4`} aria-labelledby="program-hiring-title"><div><h2 id="program-hiring-title" className="text-lg font-bold">Observações e contratações</h2><p className="mt-1 text-sm text-[#45647f]">Preencha quem fica. Em branco significa que não tem e não aparece nos arquivos.</p></div><p className="text-sm text-[#45647f]">{hiring.filter((item) => item.value?.trim()).length} de {hiring.length} preenchidos</p><div className="space-y-4">{hiring.map((item) => <label key={item.key} className="block space-y-1 text-sm font-semibold"><span>{item.name}</span><input className={input} disabled={!editable} maxLength={500} value={item.value ?? ""} placeholder={item.name.endsWith("?") ? "Sim ou não (opcional)" : "Nome de quem fica (opcional)"} onChange={(event) => edit(item.key, { hiringItems: [{ ...(item.key.startsWith("hiring:new:") ? { name: item.name } : { id: item.id }), value: event.target.value || null }] })} /></label>)}</div>
      {editable && (!addingItem ? <button className={button} type="button" onClick={() => setAddingItem(true)}>Adicionar outro item</button> : <form className="space-y-3 border-t border-[#d4dfeb] pt-4" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const name = String(data.get("itemName") ?? "").trim(); if (!name || hiring.some((item) => item.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) { setItemError("Informe um nome diferente dos itens já listados."); return; } edit(`hiring:new:${name.toLocaleLowerCase("pt-BR")}`, { hiringItems: [{ name, value: null }] }); setAddingItem(false); setItemError(null); }}><label className="block space-y-1 text-sm font-semibold"><span>Nome do novo item</span><input className={input} name="itemName" required maxLength={160} /></label>{itemError && <p role="alert">{itemError}</p>}<div className="flex gap-2"><button className={button} type="submit">Adicionar item</button><button className={button} type="button" onClick={() => { setAddingItem(false); setItemError(null); }}>Cancelar</button></div></form>)}
      <label className="block space-y-1 border-t border-[#d4dfeb] pt-4 text-sm font-semibold"><span>Observações gerais do dia</span><textarea className={input} rows={3} maxLength={2000} disabled={!editable} value={observationValue} onChange={(event) => edit("observations", { observations: event.target.value || null })} /></label>
    </section><section className={`${panel} space-y-3`} aria-labelledby="program-weather-title"><h2 id="program-weather-title" className="text-lg font-bold">Previsão do tempo</h2>
      <p className="font-semibold">{program.weather.status === "available" ? program.weather.summary : "Previsão indisponível"}</p>
      {program.weather.stale && <p className="font-semibold text-[#80531d]">Previsão desatualizada</p>}
      {program.weather.reason && <p className="text-sm text-[#45647f]">{program.weather.reason}</p>}
      {program.weather.status === "available" && <dl className="space-y-2 text-sm text-[#45647f]">
        {program.weather.forecastAt && <div><dt>Previsão para · horário de Brasília</dt><dd><time dateTime={program.weather.forecastAt}>{weatherTime(program.weather.forecastAt)}</time></dd></div>}
        {program.weather.queriedAt && <div><dt>Consultada em · horário de Brasília</dt><dd><time dateTime={program.weather.queriedAt}>{weatherTime(program.weather.queriedAt)}</time></dd></div>}
        {program.weather.source && program.weather.sourceUrl && <div><dt>Fonte</dt><dd><a className="underline underline-offset-2" href={program.weather.sourceUrl} target="_blank" rel="noreferrer">{program.weather.source}</a>{program.weather.license && program.weather.licenseUrl && <> · <a className="underline underline-offset-2" href={program.weather.licenseUrl} target="_blank" rel="noreferrer">{program.weather.license}</a></>}</dd></div>}
      </dl>}
      <button className={button} type="button" disabled={!canRefreshWeather} onClick={refreshWeather}>{phase === "refreshing" ? "Atualizando previsão…" : "Atualizar previsão"}</button>
      {dirty && <p className="text-sm text-[#45647f]">Aguarde o salvamento das alterações para atualizar a previsão.</p>}
      <p className="text-sm text-[#45647f]">A consulta respeita o intervalo da fonte. Uma previsão anterior é identificada quando a atualização não está disponível.</p></section></div>
    {editing && <GroupEditor group={editing} carriers={program.carriers} onClose={() => setEditing(null)} onSave={(value) => { edit(groupKey(value), { groups: [value] }); setEditing(null); }} />}
  </div>;
}
