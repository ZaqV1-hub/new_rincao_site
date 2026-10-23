"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { EnfermariaRecord, EnfermariaLocal } from "@/lib/enfermaria";
import { formatEnfermariaCpf } from "@/lib/enfermaria-input-format";
import { EnfermariaPagination } from "./enfermaria-pagination";
import styles from "./enfermaria-visual.module.css";

type RecordPage = { records: EnfermariaRecord[]; total: number; page: number };

async function api<T>(url: string): Promise<T> {
  const response = await fetch(url); const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Falha ao carregar histórico.");
  return payload.data as T;
}
export function EnfermariaHistory() {
  const router = useRouter();
  const [records, setRecords] = useState<EnfermariaRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [places, setPlaces] = useState<EnfermariaLocal[]>([]);
  const [filters, setFilters] = useState({ from: "", to: "", cpf: "", demand: "", professional: "", localId: "", upa: "", status: "", source: "" });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  async function search(nextPage = 1, nextFilters = filters) {
    setBusy(true); setError("");
    try {
      const params = new URLSearchParams({ action: "records-page", page: String(nextPage) });
      Object.entries(nextFilters).forEach(([key, value]) => key !== "cpf" && value && params.set(key, value));
      if (nextFilters.cpf) {
        const digits = nextFilters.cpf.replace(/\D/g, "");
        params.set(digits.length === 11 ? "cpf" : "q", nextFilters.cpf);
      }
      const [result, localList] = await Promise.all([api<RecordPage>(`/api/painel/enfermaria?${params}`), api<EnfermariaLocal[]>("/api/painel/enfermaria?action=locals")]);
      setRecords(result.records); setTotal(result.total); setPage(result.page); setAppliedFilters(nextFilters); setPlaces(localList);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao carregar histórico."); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    void Promise.all([
      api<RecordPage>("/api/painel/enfermaria?action=records-page&page=1"),
      api<EnfermariaLocal[]>("/api/painel/enfermaria?action=locals"),
    ]).then(([result, localList]) => { setRecords(result.records); setTotal(result.total); setPlaces(localList); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Falha ao carregar histórico."))
      .finally(() => setBusy(false));
  }, []);
  const set = (key: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const input = "rounded-lg border border-slate-300 px-3 py-2 text-sm";
  const visibleRecords = records;
  return <div className={`${styles.page} ${styles.workflowPage} grid gap-5 pb-7`}>
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-slate-500"><Link href="/painel/enfermaria">Enfermaria</Link> / Histórico</p><h1 className="mt-1 text-3xl font-semibold text-[#194d6b]">Histórico de atendimentos</h1><p className="mt-1 text-sm text-slate-600">Todas as fichas, abertas e encerradas.</p></div><div className="flex gap-2"><a className="rounded-lg border border-slate-300 px-4 py-2 text-sm" href={`/api/painel/enfermaria/export?${(() => { const params = new URLSearchParams(Object.entries(appliedFilters).filter(([key]) => key !== "cpf").filter(([, value]) => Boolean(value)) as [string, string][]); if (appliedFilters.cpf) { const digits = appliedFilters.cpf.replace(/\D/g, ""); params.set(digits.length === 11 ? "cpf" : "q", appliedFilters.cpf); } return params.toString(); })()}`}>Exportar Excel</a><Link className="rounded-lg bg-[#176b96] px-4 py-2 text-sm font-semibold text-white" href="/painel/enfermaria/novo">Novo atendimento</Link></div></header>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="grid gap-1 text-xs text-slate-500">De<input className={input} type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} /></label><label className="grid gap-1 text-xs text-slate-500">Até<input className={input} type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} /></label><label className="grid gap-1 text-xs text-slate-500">Cliente ou CPF<input className={input} value={filters.cpf} onChange={(e) => set("cpf", e.target.value)} placeholder="Nome ou CPF" /></label><label className="grid gap-1 text-xs text-slate-500">Tipo de demanda<select className={input} value={filters.demand} onChange={(e) => set("demand", e.target.value)}><option value="">Todos</option>{["Ferimento", "Mal-estar", "Queda", "Picada de inseto", "Afogamento", "Queimadura", "Outros"].map((v) => <option key={v}>{v}</option>)}</select></label><label className="grid gap-1 text-xs text-slate-500">Profissional<input className={input} value={filters.professional} onChange={(e) => set("professional", e.target.value)} /></label><label className="grid gap-1 text-xs text-slate-500">Local<select className={input} value={filters.localId} onChange={(e) => set("localId", e.target.value)}><option value="">Todos</option>{places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label><label className="grid gap-1 text-xs text-slate-500">Encaminhado à UPA<select className={input} value={filters.upa} onChange={(e) => set("upa", e.target.value)}><option value="">Todos</option><option value="sim">Sim</option><option value="nao">Não</option></select></label><label className="grid gap-1 text-xs text-slate-500">Status<select className={input} value={filters.status} onChange={(e) => set("status", e.target.value)}><option value="">Todos</option><option value="aberto">Aberto</option><option value="encerrado">Encerrado</option></select></label><label className="grid gap-1 text-xs text-slate-500">Tipo<select className={input} value={filters.source} onChange={(e) => set("source", e.target.value)}><option value="">Todos</option><option value="cliente">Cliente/passeio</option><option value="day_use">Day use</option><option value="sem_cadastro">Sem cadastro</option></select></label></div><div className="mt-4 flex justify-end"><button onClick={() => void search(1, filters)} className="rounded-lg bg-[#176b96] px-5 py-2 text-sm font-semibold text-white">Filtrar</button></div></section>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Nº", "Data", "Tipo", "Atendido", "Vínculo", "Local", "Demanda", "UPA", "Status"].map((title) => <th className="px-3 py-3" key={title}>{title}</th>)}</tr></thead><tbody>{visibleRecords.map((record) => <tr key={record.id} className={`${styles.clickableRow} border-t border-slate-100`} tabIndex={0} role="link" aria-label={`Abrir atendimento ${record.numberLabel}`} onClick={() => router.push(`/painel/enfermaria/${record.id}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); router.push(`/painel/enfermaria/${record.id}`); } }}><td className="px-3 py-3 font-semibold"><Link className="text-[#176b96]" href={`/painel/enfermaria/${record.id}`}>{record.numberLabel}</Link></td><td className="px-3 py-3">{new Date(record.occurredAt.replace(" ", "T")).toLocaleString("pt-BR")}</td><td className="px-3 py-3">{record.source === "sem_cadastro" ? "Sem cadastro" : record.source === "day_use" ? "Day use" : "Cliente"}</td><td className="px-3 py-3">{String((record.form.identification as Record<string, unknown> | undefined)?.name ?? ((record.form.context as Record<string, unknown> | undefined)?.buyerName ?? "—"))}</td><td className="px-3 py-3">{record.clientId ? `Cliente #${record.clientId}${record.tripId ? ` / Passeio ${record.tripId}` : ""}` : record.source === "day_use" ? `CPF ${record.buyerCpf ? formatEnfermariaCpf(record.buyerCpf) : "—"}` : "—"}</td><td className="px-3 py-3">{record.localName ?? "—"}</td><td className="px-3 py-3">{Array.isArray((record.form.complaint as Record<string, unknown> | undefined)?.demandTypes) ? ((record.form.complaint as Record<string, string[]>).demandTypes ?? []).join(", ") : "—"}</td><td className="px-3 py-3">{record.form.referralToUpa ? "Sim" : "Não"}</td><td className="px-3 py-3">{record.status === "aberto" ? "Aberto" : "Encerrado"}</td></tr>)}{(!busy && records.length === 0) && <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={9}>Nenhum atendimento encontrado.</td></tr>}</tbody></table></div>{busy && <p className="px-4 py-5 text-sm text-slate-500">Carregando…</p>}<EnfermariaPagination page={page} total={total} onChange={(nextPage) => void search(nextPage, appliedFilters)} /></section>
  </div>;
}
