"use client";

import Link from "next/link";
import { OperationalDialog } from "./operational-dialog";
import { useEffect, useState } from "react";
import { CashSessionCommandForm } from "./cash-session-command-form";
import { availableCashLocations } from "./painel-cash-sessions-page";
import { useCountingRead, countTime } from "./counting-controls";
import type { CashSession, CashSessionDetail } from "@/lib/operational-cash-session";
import type { CashLocation } from "@/lib/operational-day-contract";
import { getSaoPauloToday } from "@/lib/operational-date";

const button = "inline-flex min-h-11 items-center justify-center rounded-lg border border-[#b8cbdc] bg-white px-3 py-2 text-sm font-semibold hover:bg-[#edf4fa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#236699] disabled:opacity-50";
const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function DayCashBadge({ date }: { date: string }) {
  const { data, error } = useCountingRead<CashSession[]>(`/api/painel/caixas?date=${date}`);
  return <span className="rounded-md border border-[#d4dfeb] px-3 py-2">{error ? "Caixas abertos indisponíveis" : data ? `${data.filter(session => session.closedAt === null).length} caixa(s) aberto(s)` : "Consultando caixas…"}</span>;
}
function CashCard({ session }: { session: CashSession }) {
  const { data, error, checkedAt, refresh } = useCountingRead<CashSessionDetail>(`/api/painel/caixas/${session.id}`);
  const snapshot = data?.snapshot;
  return <li className="min-w-0 rounded-xl border border-[#d4dfeb] bg-white p-5">
    <div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{session.locationName}</h3><span>{session.closedAt ? "Fechado" : "Aberto"}</span></div>
    <p className="mt-2 text-sm text-[#45647f]">Aberto por {session.openedBy.name ?? "Operador identificado"}</p>
    {error && <p role="alert" className="mt-3 text-sm">{error} <button className={button} onClick={() => void refresh()}>Atualizar caixa</button></p>}
    {!snapshot ? <p role="status" className="py-4">{error ? "Valores indisponíveis." : "Consultando valores…"}</p> : <dl className="my-4 grid grid-cols-2 gap-4 text-sm tabular-nums">
      <div><dt>{session.type === "trips" ? "Recebido das escolas" : "Vendas"}</dt><dd className="mt-1 text-lg font-bold">{money(session.type === "trips" ? snapshot.payments.reduce((sum, payment) => sum + payment.amountCents, 0) : snapshot.sales.revenueCents)}</dd></div>
      <div><dt>Dinheiro no caixa</dt><dd className="mt-1 text-lg font-bold">{money(snapshot.expectedCashCents)}</dd></div>
      {session.type === "trips" ? <><div><dt>Recebimentos</dt><dd className="mt-1 font-bold">{snapshot.receiptsCount}</dd></div><div><dt>Despesas em dinheiro</dt><dd className="mt-1 font-bold">{money(snapshot.expensesCents)}</dd></div></> : <><div><dt>Público vendido</dt><dd className="mt-1 font-bold">{snapshot.sales.ticketCount}</dd></div><div><dt>Ingressos lidos</dt><dd className="mt-1 font-bold">{snapshot.admissions.ticketCount}</dd></div></>}
    </dl>}
    {checkedAt && <p className="mb-3 text-xs text-[#45647f]">Consultado às {countTime(checkedAt)}</p>}
    <Link className={button} href={session.type === "trips" ? `/painel/agenda/${session.date}?tab=passeios` : `/painel/caixas/${session.id}`}>{session.type === "trips" ? "Ir para o caixa de passeios" : session.closedAt ? "Ver fechamento do caixa" : "Entrar no caixa"}</Link>
  </li>;
}
export function DayCashPanel({ date, closed }: { date: string; closed: boolean }) {
  const { data: sessions, error, refresh } = useCountingRead<CashSession[]>(`/api/painel/caixas?date=${date}`);
  const [locations, setLocations] = useState<CashLocation[] | null>(null), [locationError, setLocationError] = useState("");
  const [page, setPage] = useState(1), [showOpen, setShowOpen] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!showOpen) return;
    const controller = new AbortController();
    fetch("/api/painel/locais-caixa", { cache: "no-store", signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!response.ok || !body.ok || !Array.isArray(body.data)) throw new Error(body.error?.message || "Não foi possível consultar os locais.");
      if (!controller.signal.aborted) { setLocations(body.data); setLocationError(""); }
    }).catch((error: unknown) => { if (!controller.signal.aborted) setLocationError(error instanceof Error ? error.message : "Locais indisponíveis."); });
    return () => controller.abort();
  }, [showOpen, attempt]);
  const canOpen = !closed && date === getSaoPauloToday();
  const available = locations && sessions ? availableCashLocations(locations, sessions) : [];
  const pageCount = Math.max(1, Math.ceil((sessions?.length ?? 0) / 6)), currentPage = Math.min(page, pageCount);
  return <section className="space-y-4" aria-label="Caixas da data">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Caixas da data {sessions ? `(${sessions.length})` : ""}</h2>{canOpen && <button type="button" className={button} onClick={() => setShowOpen(value => !value)} aria-expanded={showOpen}>Abrir caixa</button>}</div>
    <p className="text-sm text-[#45647f]">Um caixa aberto por local. O saldo em caixa é separado da receita da visita. Atualização a cada 5 segundos.</p>
    {!canOpen && <p className="text-sm">{closed ? "Dia finalizado: caixas somente para consulta." : "Novos caixas só podem ser abertos na data de hoje."}</p>}
    {error && <p role="alert">{error} <button className={button} onClick={() => void refresh()}>Tentar novamente</button></p>}
    {showOpen && canOpen && <OperationalDialog title="Abrir caixa" onClose={() => setShowOpen(false)}>
      {locationError && <p role="alert">{locationError} <button className={button} onClick={() => setAttempt(value => value + 1)}>Atualizar locais</button></p>}
      {!locations || !sessions ? <p role="status">Consultando locais disponíveis…</p> : <><h3 className="mb-3 font-bold">Local e troco inicial</h3>{!available.length && <p>Não há locais ativos disponíveis.</p>}<CashSessionCommandForm action="open" date={date} locations={available} disabled={!available.length} onSuccess={async () => { await refresh(); setShowOpen(false); }} /></>}
      <button type="button" className={button} onClick={() => setShowOpen(false)}>Cancelar</button>
    </OperationalDialog>}
    {!sessions ? <p role="status">Carregando caixas…</p> : !sessions.length ? <p>Nenhum caixa aberto nesta data.</p> : <><ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{sessions.slice((currentPage - 1) * 6, currentPage * 6).map(session => <CashCard key={session.id} session={session} />)}</ul>{pageCount > 1 && <nav aria-label="Páginas de caixas" className="flex flex-wrap items-center gap-3"><button className={button} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</button><span>{currentPage} de {pageCount}</span><button className={button} disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Próxima</button></nav>}</>}
  </section>;
}
