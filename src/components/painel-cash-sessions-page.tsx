"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CashSessionCommandForm } from "@/components/cash-session-command-form";
import type { CashSession } from "@/lib/operational-cash-session";
import type { CashLocation } from "@/lib/operational-day-contract";

export function availableCashLocations(locations: CashLocation[], sessions: CashSession[]) {
  return locations.filter((location) => location.active && !sessions.some((session) => session.locationId === location.id && session.closedAt === null));
}
export function PainelCashSessionsPage({ date, today, sessions, locations }: { date: string; today: string; sessions: CashSession[]; locations: CashLocation[] }) {
  const router = useRouter();
  const available = availableCashLocations(locations, sessions);
  return <div className="space-y-6 text-[#123b63]">
    <header className="space-y-3"><Link className="inline-flex min-h-11 items-center underline" href={`/painel/agenda/${date}`}>Voltar à data</Link><h1 className="text-2xl font-bold">Caixas por local</h1><p>{date.split("-").reverse().join("/")}</p></header>
    {date === today ? <section className="rounded-xl border border-[#d4dfeb] bg-white p-5 space-y-4" aria-labelledby="cash-open-title"><h2 id="cash-open-title" className="text-lg font-bold">Abrir caixa</h2><p className="text-sm text-[#45647f]">Cada local pode ter um caixa aberto. Outros operadores podem usar a mesma sessão.</p>{available.length === 0 && <p>Não há locais ativos disponíveis. Confira os caixas abertos ou o cadastro de locais.</p>}<CashSessionCommandForm action="open" date={date} locations={available} onSuccess={(data) => { const session = data as CashSession; router.push(`/painel/caixas/${session.id}`); }} /></section> : <><p>Novos caixas só podem ser abertos na data de hoje.</p><CashSessionCommandForm action="open" date={date} locations={locations} disabled onSuccess={(data) => { const session = data as CashSession; router.push(`/painel/caixas/${session.id}`); }} /></>}
    <section className="space-y-3" aria-labelledby="cash-sessions-title"><h2 id="cash-sessions-title" className="text-lg font-bold">Sessões da data</h2>{sessions.length === 0 ? <p>Nenhum caixa aberto nesta data.</p> : <ul className="grid gap-3 md:grid-cols-2">{sessions.map((session) => <li key={session.id}><Link href={`/painel/caixas/${session.id}`} className="block rounded-xl border border-[#d4dfeb] bg-white p-5 hover:border-[#236699] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#236699]"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{session.locationName}</h3><span>{session.closedAt ? "Fechado" : "Aberto"}</span></div><p className="mt-2 text-sm">Sessão #{session.id} · {session.type === "trips" ? "Passeios" : "Vendas"}</p><p className="mt-1 text-sm text-[#45647f]">Aberto por {session.openedBy.name ?? "Operador identificado"}{session.automatic ? " · Fechamento automático" : ""}</p></Link></li>)}</ul>}</section>
    <Link className="inline-flex min-h-11 items-center underline" href="/painel/locais-caixa">Cadastro de locais de caixa</Link>
  </div>;
}
