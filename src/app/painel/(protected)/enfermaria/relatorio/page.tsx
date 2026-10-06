import Link from "next/link";
import { EnfermariaPrintButton } from "@/components/enfermaria-print-button";
import { requirePainelAccess } from "@/lib/painel-session";
import { listEnfermariaDashboard } from "@/lib/enfermaria";

export const dynamic = "force-dynamic";

function ChartBars({ title, values }: { title: string; values: Array<[string, number]> }) {
  const max = Math.max(1, ...values.map(([, count]) => count));
  return <section><h2 className="font-semibold">{title}</h2><div className="mt-3 grid gap-3">{values.length ? values.map(([name, count]) => <div key={name}><div className="mb-1 flex justify-between gap-3 text-sm"><span>{name}</span><b>{count}</b></div><div className="h-2 rounded bg-slate-100"><div className="h-full rounded bg-[#2877a8]" style={{ width: `${count / max * 100}%` }} /></div></div>) : <p className="text-sm text-slate-500">Sem ocorrências neste período.</p>}</div></section>;
}

export default async function EnfermariaExecutiveReport({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePainelAccess("vis_enfermaria", "/painel/enfermaria/relatorio");
  const query = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const from = typeof query.from === "string" ? query.from : today;
  const to = typeof query.to === "string" ? query.to : today;
  const anonymous = query.anonymous === "1";
  const data = await listEnfermariaDashboard(from, to);
  const rows = Object.entries(data.demandCounts).sort((a, b) => b[1] - a[1]);
  const sourceCounts = [
    ["Cliente/passeio", data.records.filter((record) => record.source === "cliente").length],
    ["Day use", data.records.filter((record) => record.source === "day_use").length],
    ["Sem cadastro", data.records.filter((record) => record.source === "sem_cadastro").length],
  ] as Array<[string, number]>;
  return <main className="mx-auto max-w-5xl space-y-6 bg-white p-8 print:max-w-none print:p-0">
    <nav className="flex flex-wrap justify-between gap-3 print:hidden"><Link href={`/painel/enfermaria?from=${from}&to=${to}`} className="text-sm text-[#176b96]">← Voltar à Enfermaria</Link><div className="flex gap-2"><Link href={`/painel/enfermaria/relatorio?from=${from}&to=${to}&anonymous=${anonymous ? "0" : "1"}`} className="rounded-lg border px-4 py-2 text-sm">{anonymous ? "Incluir nome e CPF" : "Sem nome e CPF"}</Link><EnfermariaPrintButton /></div></nav>
    <header className="flex min-h-[70vh] flex-col justify-center border-b-2 border-[#176b96] pb-8 print:break-after-page"><p className="text-sm uppercase tracking-[0.2em] text-[#176b96]">Clube e Park Rincão</p><h1 className="mt-3 text-4xl font-semibold text-slate-900">Relatório executivo<br />Enfermaria</h1><p className="mt-4 text-lg text-slate-600">Período de {new Date(`${from}T12:00:00`).toLocaleDateString("pt-BR")} a {new Date(`${to}T12:00:00`).toLocaleDateString("pt-BR")}</p><p className="mt-3 text-sm font-medium text-slate-500">{anonymous ? "Relatório anonimizado: nome e CPF removidos." : "Acesso restrito a Gerente e Enfermeiro(a)."}</p><div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Atendimentos", data.totals.count], ["Em aberto", data.totals.open], ["Encaminhados à UPA", data.totals.upa], ["Sinais de alerta", data.totals.urgent]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold text-[#194d6b]">{value}</p></div>)}</div></header>
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Atendimentos", data.totals.count], ["Em aberto", data.totals.open], ["Encaminhados à UPA", data.totals.upa], ["Sinais de alerta", data.totals.urgent]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold text-[#194d6b]">{value}</p></div>)}</section>
    <section className="grid gap-6 sm:grid-cols-2"><ChartBars title="Ocorrências por local" values={Object.entries(data.localCounts).sort((a, b) => b[1] - a[1])} /><ChartBars title="Tipo de demanda" values={rows} /><ChartBars title="Por faixa de horário" values={Object.entries(data.timeCounts)} /><ChartBars title="Cliente/passeio, day use e sem cadastro" values={sourceCounts} /></section>
    <ChartBars title="Linha do tempo por dia" values={Object.entries(data.timeline).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => [new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR"), count])} />
    <section><h2 className="font-semibold">Atendimentos do período</h2><table className="mt-3 w-full border-collapse text-xs"><thead><tr>{["Nº", "Data", "Tipo", ...(anonymous ? [] : ["Atendido", "CPF"]), "Local", "Demanda", "Status"].map((title) => <th key={title} className="border border-slate-300 bg-slate-50 px-2 py-2 text-left">{title}</th>)}</tr></thead><tbody>{data.records.map((record) => { const identification = (record.form.identification ?? {}) as Record<string, unknown>; const complaint = (record.form.complaint ?? {}) as Record<string, unknown>; return <tr key={record.id}><td className="border border-slate-300 px-2 py-2">{record.numberLabel}</td><td className="border border-slate-300 px-2 py-2">{record.occurredAt}</td><td className="border border-slate-300 px-2 py-2">{record.source}</td>{!anonymous && <><td className="border border-slate-300 px-2 py-2">{String(identification.name ?? "")}</td><td className="border border-slate-300 px-2 py-2">{String(identification.cpf ?? record.buyerCpf ?? "")}</td></>}<td className="border border-slate-300 px-2 py-2">{record.localName ?? ""}</td><td className="border border-slate-300 px-2 py-2">{Array.isArray(complaint.demandTypes) ? complaint.demandTypes.join(", ") : ""}</td><td className="border border-slate-300 px-2 py-2">{record.status}</td></tr>; })}</tbody></table></section>
    <footer className="border-t pt-4 text-xs text-slate-500">Documento interno para acompanhamento de segurança do Rincão · Gerado em {new Date().toLocaleString("pt-BR")}</footer>
  </main>;
}
