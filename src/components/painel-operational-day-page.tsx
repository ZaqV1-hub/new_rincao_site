"use client";

import Link from "next/link";
import { useEffect, useState, type KeyboardEvent } from "react";
import type { OperationalDaySummary, SummarySourceValue } from "@/lib/operational-day-summary";
import type { OperationalDayList } from "@/lib/operational-day-lists";

const button = "inline-flex min-h-11 items-center justify-center rounded-lg border border-[#b8cbdc] bg-white px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#236699] disabled:opacity-50";
const panel = "min-w-0 rounded-xl border border-[#d4dfeb] bg-white p-4 sm:p-6";
const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const number = (value: number) => value.toLocaleString("pt-BR");
const labels: Record<string, string> = {
  bilhe: "Bilheteria", reser: "Reserva", ponli: "Site", pend: "Em processamento", expi: "Expirada", conc: "Concluída", canc: "Cancelada",
  abe: "Aberta", fec: "Fechada", lot: "Esgotada", escol: "Escolar", igrej: "Igreja", casam: "Casamento", melho: "Melhor idade", confr: "Confraternização", ongs: "ONG", grmix: "Grupo misto",
};
const tabs = [
  { id: "resumo", label: "Resumo" }, { id: "passeios", label: "Passeios" },
  { id: "compras", label: "Compras e vouchers" }, { id: "caixas", label: "Caixas" },
  { id: "fechamento", label: "Fechamento do dia" },
] as const;
type Tab = typeof tabs[number]["id"];
type DayList = OperationalDayList;

function SourceValue({ label, source, currency = false, maximum }: { label: string; source: SummarySourceValue<number>; currency?: boolean; maximum?: number }) {
  return <div className="min-w-0 py-3">
    <dt className="text-sm text-[#45647f]">{label}</dt>
    <dd className="mt-1 font-semibold tabular-nums">{source.status === "available" ? (currency ? money(source.value) : number(source.value)) : "Indisponível"}</dd>
    {source.status === "available" && maximum !== undefined && <dd aria-hidden="true" className="mt-2 h-2 overflow-hidden rounded bg-[#e5edf5]"><div className="h-full rounded bg-[#236699]" style={{ width: `${maximum > 0 ? source.value / maximum * 100 : 0}%` }} /></dd>}
    {source.status === "unavailable" && <dd className="mt-1 text-sm text-[#45647f]">{source.reason}</dd>}
  </div>;
}

function DayListPanel({ date, kind }: { date: string; kind: DayList["kind"] }) {
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: DayList; error?: string } | null>(null);
  const key = `${date}:${kind}:${page}:${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/painel/dias/${date}/listas?kind=${kind}&page=${page}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 403) throw new Error("Seu perfil não tem permissão para consultar esta lista.");
        if (response.status === 401) throw new Error("Sua sessão expirou. Entre novamente para consultar esta lista.");
        if (!response.ok) throw new Error("Não foi possível carregar a lista. Tente novamente.");
        const body = await response.json();
        if (!body.ok || body.data?.date !== date || body.data?.kind !== kind || body.data?.page !== page || !Array.isArray(body.data?.items)) throw new Error("Não foi possível carregar a lista. Tente novamente.");
        if (!controller.signal.aborted) setResult({ key, data: body.data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ key, error: error instanceof Error ? error.message : "Não foi possível carregar a lista. Tente novamente." });
      });
    return () => controller.abort();
  }, [date, kind, page, attempt, key]);
  const current = result?.key === key ? result : null;
  const data = current?.data;
  return <div className={`${panel} space-y-4`}>
    <h2 className="text-lg font-bold">{kind === "groups" ? "Passeios da data" : "Compras e vouchers da visita"}</h2>
    <p className="text-sm text-[#45647f]">{kind === "groups" ? "Pessoas pagas online são ingressos registrados, não a previsão de público nem a contagem no parque." : "Valores correspondem aos itens para esta data de visita; não ao valor integral da compra nem aos recebimentos do dia. Abra a compra para consultar seus vouchers."}</p>
    {!current && <p role="status">Carregando lista…</p>}
    {current?.error && <div className="space-y-3"><p role="alert">{current.error}</p><button type="button" className={button} onClick={() => setAttempt(attempt + 1)}>Tentar novamente</button></div>}
    {data && <>
      <p role="status" className="text-sm text-[#45647f]">{number(data.total)} registro(s) · Página {data.page} de {Math.max(1, data.pageCount)}</p>
      {data.items.length === 0 ? <p>Nenhum registro encontrado nesta data.</p> : <ul className="divide-y divide-[#d4dfeb]">{data.items.map((item) => "purchaseId" in item ? <li key={item.purchaseId} className="flex flex-wrap items-start justify-between gap-3 py-4">
        <div className="min-w-0"><Link className="inline-flex min-h-11 items-center font-semibold underline" href={`/painel/compras/${item.purchaseId}`}>Compra #{item.purchaseId} · {item.buyerName || "Cliente não informado"}</Link><p className="text-sm text-[#45647f]">{labels[item.status] ?? (item.status || "Situação não informada")} · {labels[item.channel] ?? (item.channel || "Canal não informado")} · {number(item.itemCount)} item(ns) da data</p></div>
        <p className="font-semibold tabular-nums">{money(item.dateAmountCents)}</p>
      </li> : <li key={`${item.agendaId}:${item.clientId}`} className="py-4"><Link className="inline-flex min-h-11 items-center font-semibold underline" href={`/painel/clientes/passeios/${item.agendaId}/alunos?clientId=${item.clientId}`}>{item.clientName || "Cliente não informado"}</Link><p className="text-sm text-[#45647f]">{labels[item.agendaType] ?? item.agendaType} · {labels[item.status] ?? (item.status || "Situação não informada")} · {number(item.paidOnlinePeople)} pessoa(s) paga(s) online</p></li>)}</ul>}
      <nav aria-label="Paginação da lista" className="flex flex-wrap gap-2"><button type="button" className={button} disabled={page <= 1} onClick={() => setPage(page - 1)}>Página anterior</button><button type="button" className={button} disabled={page >= data.pageCount} onClick={() => setPage(page + 1)}>Próxima página</button></nav>
    </>}
  </div>;
}

export function PainelOperationalDayPage({ summary, canManage }: { summary: OperationalDaySummary; canManage: boolean }) {
  const [tab, setTab] = useState<Tab>("resumo");
  const { configuration: day, navigation, revenue, attendance, forecast } = summary;
  const dateLabel = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${summary.date}T12:00:00Z`));
  const revenueMaximum = Math.max(0, ...[revenue.siteNetCents, revenue.gateNetCents, revenue.servicesNetCents, revenue.finalizedTripsNetCents].map((source) => source.status === "available" ? source.value : 0));
  const calendarHref = `/painel/agenda?mes=${Number(summary.date.slice(5, 7))}&ano=${summary.date.slice(0, 4)}&dia=${summary.date}`;
  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    setTab(tabs[next].id);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
  }
  return <div className="mx-auto w-full min-w-0 max-w-[1120px] space-y-6 text-[#123b63] [overflow-wrap:anywhere]">
    <Link href={calendarHref} className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Voltar ao calendário</Link>
    <header className={`${panel} space-y-4`}>
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row"><div className="w-full min-w-0 sm:flex-1"><h1 className="text-2xl font-bold leading-tight sm:text-3xl">{dateLabel}</h1><p className="mt-2 text-sm text-[#45647f]">{summary.park === "rincao" ? "Rincão" : "Estância"} · Resumo da data</p></div>
        <nav aria-label="Datas com movimento" className="flex flex-wrap gap-2">
          {navigation.previousDate ? <Link href={`/painel/agenda/${navigation.previousDate}`} className={button} aria-label="Data anterior com movimento">Anterior</Link> : <button className={button} disabled aria-label="Sem data anterior com movimento">Anterior</button>}
          {navigation.nextDate ? <Link href={`/painel/agenda/${navigation.nextDate}`} className={button} aria-label="Próxima data com movimento">Próxima</Link> : <button className={button} disabled aria-label="Sem próxima data com movimento">Próxima</button>}
        </nav>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-md bg-[#edf4fa] px-3 py-2 font-semibold">{!day ? "Configuração pendente de conferência" : day.closed ? "Data bloqueada para edição" : day.dayUseOpen ? "Day use aberto" : summary.groupCount > 0 ? "Só grupos · day use fechado" : "Day use fechado"}</span>
        {day?.onlineSoldOut && <span className="rounded-md bg-[#fff3dc] px-3 py-2">Vendas online esgotadas</span>}
        {day?.priceTableId ? <Link href={`/painel/tabela-preco/${day.priceTableId}`} className="rounded-md border border-[#d4dfeb] px-3 py-2 underline">Tabela de preço #{day.priceTableId}</Link> : <span className="rounded-md border border-[#d4dfeb] px-3 py-2">Tabela de preço {day ? "não definida" : "indisponível"}</span>}
        <span className="rounded-md border border-[#d4dfeb] px-3 py-2">{number(summary.groupCount)} passeio(s)</span>
      </div>
      <div className="flex flex-wrap items-center gap-3">{canManage && <Link className={button} href={`/painel/agenda/${summary.date}/editar`}>Editar day use</Link>}<p className="text-sm text-[#45647f]">Dia seguinte, caixas e fechamento: integração pendente.</p></div>
    </header>
    <div role="tablist" aria-label="Informações da data" className="flex flex-wrap gap-2 border-b border-[#d4dfeb] pb-3">
      {tabs.map((item, index) => <button key={item.id} id={`day-tab-${item.id}`} role="tab" type="button" aria-selected={tab === item.id} aria-controls="day-panel" tabIndex={tab === item.id ? 0 : -1} onKeyDown={(event) => navigateTabs(event, index)} onClick={() => setTab(item.id)} className={`${button} ${tab === item.id ? "border-[#236699] bg-[#edf4fa] underline decoration-2 underline-offset-4" : ""}`}>{item.label}{item.id === "passeios" ? ` (${number(summary.groupCount)})` : ""}</button>)}
    </div>
    <section id="day-panel" role="tabpanel" aria-labelledby={`day-tab-${tab}`} tabIndex={0} className="min-w-0 space-y-6 focus-visible:outline-2 focus-visible:outline-[#236699]">
      {tab === "resumo" && <>
        <section className={panel} aria-labelledby="day-attendance-title"><h2 id="day-attendance-title" className="text-lg font-bold">Público da data</h2><dl className="mt-2 grid gap-x-6 divide-y divide-[#d4dfeb] sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
          <SourceValue label="Day use vendido para a data" source={forecast.ticketsForSelectedDate} /><SourceValue label="Pessoas previstas em grupos" source={forecast.plannedGroupPeople} /><SourceValue label="Day use: entradas reais no parque" source={attendance.dayUseAdmitted} /><SourceValue label="Já no parque: total" source={attendance.totalAdmitted} />
        </dl><p className="mt-3 text-sm text-[#45647f]">Vendas seguem a data escolhida para visita. Entradas seguem a data em que o ingresso foi usado.</p></section>
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <section className={panel} aria-labelledby="day-revenue-title"><h2 id="day-revenue-title" className="text-lg font-bold">Receita da visita</h2><p className="mt-2 text-sm text-[#45647f]">Valores das compras confirmadas para esta data de visita. Não representam recebimentos do dia nem saldo em caixa.</p><dl className="mt-3 divide-y divide-[#d4dfeb]">
            <SourceValue label="Ingressos no site" source={revenue.siteNetCents} currency maximum={revenueMaximum} /><SourceValue label="Ingressos nos caixas e reservas" source={revenue.gateNetCents} currency maximum={revenueMaximum} /><SourceValue label="Adicionais e serviços identificados" source={revenue.servicesNetCents} currency maximum={revenueMaximum} /><SourceValue label="Passeios finalizados" source={revenue.finalizedTripsNetCents} currency maximum={revenueMaximum} />
            <div className="py-4"><dt className="font-bold">Subtotal conhecido · parcial</dt><dd className="mt-1 text-2xl font-bold tabular-nums">{money(revenue.knownSubtotalCents)}</dd><dd className="mt-1 text-sm text-[#45647f]">Soma das fontes disponíveis; não é o faturamento total do dia.</dd></div>
            <SourceValue label="Faturamento total do dia" source={revenue.totalCents} currency /><SourceValue label="Valores sem classificação, fora do subtotal" source={revenue.unclassifiedNetCents} currency />
          </dl></section>
          <div className="space-y-6"><section className={panel} aria-labelledby="day-count-title"><h2 id="day-count-title" className="text-lg font-bold">Contagem dos passeios</h2><p className="mt-2 text-sm text-[#45647f]">{summary.groupCount === 0 ? "Nenhum passeio cadastrado nesta data." : `${number(summary.groupCount)} passeio(s) cadastrado(s) nesta data.`}</p><dl><SourceValue label="Pessoas em veículos com contagem concluída" source={attendance.completedVehiclePeople} /></dl><button type="button" className={button} onClick={() => { setTab("passeios"); document.getElementById("day-tab-passeios")?.focus(); }}>Ver passeios</button></section>
            <section className={panel} aria-labelledby="day-finance-title"><h2 id="day-finance-title" className="text-lg font-bold">Recebimentos e fechamento</h2><dl className="mt-2 divide-y divide-[#d4dfeb]"><SourceValue label="Recebimentos na data" source={summary.receipts} currency /><SourceValue label="Caixas por local" source={summary.cash} /><SourceValue label="Despesas da data" source={summary.expenses} currency /><SourceValue label="Fechamento do dia" source={summary.closure} /></dl></section>
          </div>
        </div>
        {summary.warnings.length > 0 && <aside className={`${panel} bg-[#f4f8fc]`} aria-labelledby="day-warnings"><h2 id="day-warnings" className="font-bold">Pendências da apuração</h2><ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-[#45647f]">{summary.warnings.map((warning) => <li key={warning.code}>{warning.message}</li>)}</ul></aside>}
      </>}
      {(tab === "passeios" || tab === "compras") && <DayListPanel key={`${summary.date}:${tab}`} date={summary.date} kind={tab === "passeios" ? "groups" : "purchases"} />}
      {tab === "caixas" && <div className={`${panel} space-y-3`}><h2 className="text-lg font-bold">Caixas</h2><p>{summary.cash.reason}</p><Link className="inline-flex min-h-11 items-center underline" href="/painel/bilheteria">Abrir bilheteria existente</Link></div>}
      {tab === "fechamento" && <div className={`${panel} space-y-3`}><h2 className="text-lg font-bold">Fechamento do dia</h2><p>{summary.closure.reason}</p><p className="text-sm text-[#45647f]">O subtotal disponível no resumo é parcial e não constitui um fechamento.</p></div>}
    </section>
    <p className="text-xs text-[#45647f]">Consultado em <time dateTime={summary.generatedAt}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(summary.generatedAt))}</time> (horário de São Paulo).</p>
  </div>;
}
