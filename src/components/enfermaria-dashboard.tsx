"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { EnfermariaRecord } from "@/lib/enfermaria";

type DashboardData = {
  records: EnfermariaRecord[];
  totals: { count: number; open: number; upa: number; urgent: number };
  demandCounts: Record<string, number>;
  localCounts: Record<string, number>;
  timeCounts: Record<string, number>;
  timeline: Record<string, number>;
};
async function load(from: string, to: string) {
  const response = await fetch(`/api/painel/enfermaria?action=dashboard&from=${from}&to=${to}`);
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error?.message ?? "Falha ao carregar o painel.");
  return result.data as DashboardData;
}
function dateString(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function periodRange(period: string) {
  const end = new Date(); const start = new Date();
  if (period === "semana") start.setDate(start.getDate() - 6);
  if (period === "mes") start.setDate(1);
  return { from: dateString(start), to: dateString(end) };
}

export function EnfermariaDashboard() {
  const [period, setPeriod] = useState("hoje");
  const [from, setFrom] = useState(periodRange("hoje").from);
  const [to, setTo] = useState(periodRange("hoje").to);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void load(from, to).then(setData).catch((e) => setError(e.message)); }, [from, to]);
  const recent = useMemo(() => data?.records.slice(0, 8) ?? [], [data]);
  const maxTimeline = Math.max(1, ...Object.values(data?.timeline ?? {}));
  const chart = (title: string, description: string, values: Record<string, number>) => {
    const rows = Object.entries(values).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...rows.map(([, value]) => value));
    return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-800">{title}</h2><p className="mt-1 text-xs text-slate-500">{description}</p><div className="mt-5 grid gap-3">{rows.length ? rows.map(([label, value]) => <div key={label}><div className="mb-1 flex justify-between text-xs"><span className="text-slate-700">{label}</span><span className="font-semibold text-slate-800">{value}</span></div><div className="h-2 rounded bg-slate-100"><div className="h-full rounded bg-[#2877a8]" style={{ width: `${(value / max) * 100}%` }} /></div></div>) : <p className="text-sm text-slate-400">Sem registros no período.</p>}</div></section>;
  };
  function choosePeriod(value: string) { setPeriod(value); if (value !== "personalizado") { const r = periodRange(value); setFrom(r.from); setTo(r.to); } }

  return <div className="mx-auto grid max-w-7xl gap-6 pb-12">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-slate-500">Painel do Rincão</p><h1 className="mt-1 text-3xl font-semibold text-[#194d6b]">Enfermaria</h1><p className="mt-1 text-sm text-slate-600">Atendimentos registrados pela equipe de enfermagem do Rincão.</p></div><div className="flex flex-wrap gap-2"><Link href="/painel/enfermaria/historico" className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Histórico</Link><Link href="/painel/enfermaria/locais" className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Locais do parque</Link><a href={`/api/painel/enfermaria/export?kind=cases&from=${from}&to=${to}`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Exportar lista</a><Link href={`/painel/enfermaria/relatorio?from=${from}&to=${to}`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Relatório executivo</Link><Link href="/painel/enfermaria/novo" className="rounded-lg bg-[#176b96] px-4 py-2 text-sm font-semibold text-white">Novo atendimento</Link></div></header>
    <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="min-w-[180px]"><label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Período</label><select className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" value={period} onChange={(e) => choosePeriod(e.target.value)}><option value="hoje">Hoje</option><option value="semana">Semana</option><option value="mes">Mês</option><option value="personalizado">Personalizado</option></select></div>{period === "personalizado" && <><label className="text-xs text-slate-500">De<input type="date" className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label className="text-xs text-slate-500">Até<input type="date" className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" value={to} onChange={(e) => setTo(e.target.value)} /></label></>}</section>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {!data ? <p className="py-8 text-slate-500">Carregando atendimentos…</p> : <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Atendimentos", data.totals.count, "no período"], ["Em aberto", data.totals.open, "fichas ainda não encerradas"], ["Encaminhados à UPA", data.totals.upa, "no período"], ["Sinais de alerta", data.totals.urgent, "urgência marcada"]].map(([label, value, helper]) => <article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold text-[#194d6b]">{value}</p><p className="mt-1 text-xs text-slate-500">{helper}</p></article>)}</section>
      <section className="grid gap-4 lg:grid-cols-2">{chart("Ocorrências por local", "Onde os atendimentos aconteceram no parque.", data.localCounts)}{chart("Atendimentos por tipo de demanda", "Conforme o checklist da ficha.", data.demandCounts)}</section>
      <section className="grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-800">Linha do tempo</h2><p className="mt-1 text-xs text-slate-500">Atendimentos por dia no período selecionado.</p><div className="mt-5 flex h-36 items-end gap-1 overflow-x-auto border-b border-slate-200">{Object.entries(data.timeline).sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => <div key={day} className="flex min-w-8 flex-1 flex-col items-center justify-end gap-1"><span className="text-[10px] text-slate-500">{count}</span><div className="w-full rounded-t bg-[#2877a8]" style={{ height: `${Math.max(5, count / maxTimeline * 100)}px` }} /><span className="text-[9px] text-slate-400">{day.slice(8)}</span></div>)}</div></section>{chart("Ocorrências por faixa de horário", "Quando os atendimentos acontecem.", data.timeCounts)}</section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-800">Cliente/passeio contra day use</h2><p className="mt-1 text-xs text-slate-500">Quem foi atendido.</p><div className="mt-4 flex flex-wrap gap-3">{(["cliente", "day_use", "sem_cadastro"] as const).map((source) => <div key={source} className="rounded-xl bg-slate-50 px-4 py-3 text-sm"><span className="font-semibold">{source === "cliente" ? "Cliente/passeio" : source === "day_use" ? "Day use" : "Sem cadastro"}</span><span className="ml-3 text-[#176b96]">{data.records.filter((record) => record.source === source).length}</span></div>)}</div></section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="font-semibold text-slate-800">Últimos atendimentos</h2><p className="mt-1 text-xs text-slate-500">{data.totals.count} atendimentos no período escolhido.</p></div><Link className="text-sm font-semibold text-[#176b96]" href="/painel/enfermaria/historico">Ver histórico completo →</Link></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Nº", "Data", "Atendido", "Local", "Demanda", "Status"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{recent.map((record) => <tr key={record.id} className="border-t border-slate-100 hover:bg-slate-50"><td className="px-4 py-3"><Link className="font-semibold text-[#176b96]" href={`/painel/enfermaria/${record.id}`}>{record.numberLabel}</Link></td><td className="px-4 py-3">{new Date(record.occurredAt.replace(" ", "T")).toLocaleString("pt-BR")}</td><td className="px-4 py-3">{String((record.form.identification as Record<string, unknown> | undefined)?.name ?? ((record.form.context as Record<string, unknown> | undefined)?.buyerName ?? "—"))}</td><td className="px-4 py-3">{record.localName ?? "—"}</td><td className="px-4 py-3">{Array.isArray((record.form.complaint as Record<string, unknown> | undefined)?.demandTypes) ? ((record.form.complaint as Record<string, string[]>).demandTypes ?? []).join(", ") : "—"}</td><td className="px-4 py-3">{record.status === "aberto" ? "Em aberto" : "Encerrado"}</td></tr>)}{recent.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Nenhum atendimento neste período.</td></tr>}</tbody></table></div></section>
      <div className="flex justify-end"><Link href={`/painel/enfermaria/exportar?kind=pack&from=${from}&to=${to}`} className="text-sm font-semibold text-[#176b96]">Imprimir pacote de fichas do período →</Link></div>
    </>}
  </div>;
}
