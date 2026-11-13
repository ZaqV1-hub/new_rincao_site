"use client";

import { PainelTripDay } from "./painel-trip-day";
import { PainelCountingSummary } from "./painel-counting-summary";
import Link from "next/link";
import { useEffect, useState, type KeyboardEvent } from "react";
import type { DayProgram } from "@/lib/day-program";
import type { OperationalDaySummary, SummarySourceValue } from "@/lib/operational-day-summary";
import { purchaseDetailHref, purchaseListHref, readPurchaseListContext, type PurchaseListContext } from "@/lib/operational-purchase-navigation";
import type { OperationalDayList } from "@/lib/operational-day-lists";
import { PainelPurchaseBatch } from "@/components/painel-purchase-batch";

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

function DayListPanel({ date, kind, context, onContextChange, canOperate }: { date: string; kind: DayList["kind"]; context: PurchaseListContext; onContextChange: (context: PurchaseListContext) => void; canOperate: boolean }) {
  const [groupPage, setGroupPage] = useState(1);
  const [search, setSearch] = useState(context.filters.query);
  const page = kind === "purchases" ? context.page : groupPage;
  const { filters } = context;
  function setPage(next: number) { setSelection({ key: "",ids: [] }); if (kind === "purchases") onContextChange({ ...context, page: next }); else setGroupPage(next); }
  function applyFilters(next: typeof filters) { setSelection({ key: "",ids: [] }); onContextChange({ ...context, page: 1, filters: next }); }
  const query = new URLSearchParams({ kind, page: String(page), ...(kind === "purchases" ? filters : {}) }).toString();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: DayList; error?: string } | null>(null);
  const key = `${date}:${query}:${attempt}`;
  const [selection,setSelection] = useState<{ key: string; ids: number[] }>({ key: "",ids: [] });
  const [batchBusy,setBatchBusy] = useState(false);
  const selected = selection.key === key ? selection.ids : [];
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/painel/dias/${date}/listas?${query}`, { cache: "no-store", signal: controller.signal })
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
  }, [date, kind, page, query, attempt, key]);
  const current = result?.key === key ? result : null;
  const data = current?.data;
  const counters = data?.kind === "purchases" ? data.counters : null;
  return <div className={`${panel} space-y-4`}>
    <h2 className="text-lg font-bold">{kind === "groups" ? "Passeios da data" : "Compras e vouchers da visita"}</h2>
    <p className="text-sm text-[#45647f]">{kind === "groups" ? "Pessoas pagas online são ingressos registrados, não a previsão de público nem a contagem no parque." : "Valores correspondem aos itens para esta data de visita; não ao valor integral da compra nem aos recebimentos do dia. Abra a compra para consultar seus vouchers."}</p>
    {kind === "purchases" && <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); applyFilters({ ...filters, query: search.trim() }); }}>
      <label className="grid gap-1 text-sm font-semibold">Origem<select className={button} value={filters.origin} onChange={(event) => applyFilters({ ...filters, origin: event.target.value as typeof filters.origin })}>
        <option value="all">Todas ({counters?.origin.all ?? "…"})</option><option value="site">Site ({counters?.origin.site ?? "…"})</option><option value="gate">Caixas e reservas ({counters?.origin.gate ?? "…"})</option>
      </select></label>
      <label className="grid gap-1 text-sm font-semibold">Tipo<select className={button} value={filters.type} onChange={(event) => applyFilters({ ...filters, type: event.target.value as typeof filters.type })}>
        <option value="all">Todos ({counters?.type.all ?? "…"})</option><option value="dayuse">Day use ({counters?.type.dayuse ?? "…"})</option><option value="group">Passeios ({counters?.type.group ?? "…"})</option>
      </select></label>
      <label className="grid gap-1 text-sm font-semibold">Compra, nome ou CPF<input className={button} maxLength={120} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <div className="flex items-end gap-2"><button type="submit" className={button}>Buscar</button><button type="button" className={button} onClick={() => { setSearch(""); applyFilters({ origin: "all", type: "all", query: "" }); }}>Limpar filtros</button></div>
    </form>}
    {!current && <p role="status">Carregando lista…</p>}
    {current?.error && <div className="space-y-3"><p role="alert">{current.error}</p><button type="button" className={button} onClick={() => setAttempt(attempt + 1)}>Tentar novamente</button></div>}
    {data && <>
      <p role="status" className="text-sm text-[#45647f]">{number(data.total)} registro(s) · Página {data.page} de {Math.max(1, data.pageCount)}</p>
      {data.items.length === 0 ? <p>Nenhum registro encontrado nesta data.</p> : <ul className="divide-y divide-[#d4dfeb]">{data.items.map((item) => "purchaseId" in item ? <li key={item.purchaseId} className="flex flex-wrap items-start justify-between gap-3 py-4">
        {canOperate && item.batchSelectable && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" aria-label={`Selecionar compra ${item.purchaseId} para alterar data ou validade`} disabled={batchBusy} checked={selected.includes(item.purchaseId)} onChange={event => setSelection({ key,ids: event.target.checked ? [...selected,item.purchaseId] : selected.filter(id => id !== item.purchaseId) })} />Selecionar</label>}
        <div className="min-w-0"><Link className="inline-flex min-h-11 items-center font-semibold underline" href={purchaseDetailHref(item.purchaseId, context)}>Compra #{item.purchaseId} · {item.buyerName || "Cliente não informado"}</Link><p className="text-sm text-[#45647f]">{labels[item.status] ?? (item.status || "Situação não informada")} · {labels[item.channel] ?? (item.channel || "Canal não informado")} · {number(item.itemCount)} item(ns) da data</p></div>
        <p className="font-semibold tabular-nums">{money(item.dateAmountCents)}</p>
      </li> : <li key={`${item.agendaId}:${item.clientId}`} className="py-4"><Link className="inline-flex min-h-11 items-center font-semibold underline" href={`/painel/clientes/passeios/${item.agendaId}/alunos?clientId=${item.clientId}`}>{item.clientName || "Cliente não informado"}</Link><p className="text-sm text-[#45647f]">{labels[item.agendaType] ?? item.agendaType} · {labels[item.status] ?? (item.status || "Situação não informada")} · {number(item.paidOnlinePeople)} pessoa(s) paga(s) online</p></li>)}</ul>}
      <nav aria-label="Paginação da lista" className="flex flex-wrap gap-2"><button type="button" className={button} disabled={page <= 1} onClick={() => setPage(page - 1)}>Página anterior</button><button type="button" className={button} disabled={page >= data.pageCount} onClick={() => setPage(page + 1)}>Próxima página</button></nav>
    </>}
    {kind === "purchases" && canOperate && <PainelPurchaseBatch purchaseIds={selected} onBusyChange={setBatchBusy} onComplete={() => setAttempt(value => value+1)} />}
  </div>;
}

const programLabels: Record<DayProgram["status"], string> = { uncreated: "A criar", created: "Criado", exported: "Criado e enviado · arquivos gerados", past_created: "Já ocorreu", past_uncreated: "Já ocorreu e não criado" };
export function PainelOperationalDayPage({ summary, canManage, canAccessCash = false, canAccessProgram = false, programStatus = null, programError, initialPurchaseContext, initialTab, financialActorCpf }: {
  summary: OperationalDaySummary; financialActorCpf?: string; canManage: boolean; canAccessCash?: boolean; canAccessProgram?: boolean; programStatus?: DayProgram["status"] | null; programError?: string | null; initialPurchaseContext?: PurchaseListContext; initialTab?: string;
}) {
  const [tab, setTab] = useState<Tab>(tabs.some((item) => item.id === initialTab) ? initialTab as Tab : "resumo");
  const [purchaseContext, setPurchaseContext] = useState(initialPurchaseContext ?? readPurchaseListContext(summary.date, {}));
  function updatePurchaseContext(context: PurchaseListContext) {
    setPurchaseContext(context);
    window.history.replaceState(null, "", purchaseListHref(context));
  }
  const programAction = !canManage || summary.configuration?.closed ? "Abrir" : programStatus === "uncreated" ? "Criar" : programStatus === "created" || programStatus === "exported" ? "Alterar" : "Abrir";
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
      <div className="flex flex-wrap items-center gap-3">{canManage && <Link className={button} href={`/painel/agenda/${summary.date}/editar`}>Editar day use</Link>}{canAccessProgram && <><Link className={button} href={`/painel/agenda/${summary.date}/dia-seguinte?returnTo=${summary.date}`}>Programação do dia · {programAction}</Link>
        {programStatus ? <span className="text-sm text-[#45647f]" title={programStatus === "exported" ? "Os arquivos foram gerados; o envio é feito pelo gerente." : undefined}>{programLabels[programStatus]}</span> : <p role="alert" className="text-sm text-[#694812]">{programError || "Programação do dia indisponível. Atualize a página para tentar novamente."}</p>}</>}
        {canAccessCash && <Link className={button} href={`/painel/caixas?date=${summary.date}`}>Caixas da data</Link>}
        <p className="text-sm text-[#45647f]">Fechamento diário: integração pendente.</p></div>
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
            {revenue.totalCents.status === "unavailable" && <div className="py-4"><dt className="font-bold">Subtotal conhecido · parcial</dt><dd className="mt-1 text-2xl font-bold tabular-nums">{money(revenue.knownSubtotalCents)}</dd><dd className="mt-1 text-sm text-[#45647f]">Soma das fontes disponíveis; não é o faturamento total do dia.</dd></div>}
            <SourceValue label="Faturamento total do dia" source={revenue.totalCents} currency /><SourceValue label="Valores sem classificação, fora do subtotal" source={revenue.unclassifiedNetCents} currency />
          </dl></section>
          <div className="space-y-6"><section className={panel} aria-labelledby="day-count-title"><h2 id="day-count-title" className="text-lg font-bold">Contagem dos passeios</h2><p className="mt-2 text-sm text-[#45647f]">{summary.groupCount === 0 ? "Nenhum passeio cadastrado nesta data." : `${number(summary.groupCount)} passeio(s) cadastrado(s) nesta data.`}</p><dl><SourceValue label="Pessoas em veículos com contagem concluída" source={attendance.completedVehiclePeople} /></dl><button type="button" className={button} onClick={() => { setTab("passeios"); document.getElementById("day-tab-passeios")?.focus(); }}>Ver passeios</button></section>
            <section className={panel} aria-labelledby="day-finance-title"><h2 id="day-finance-title" className="text-lg font-bold">Recebimentos e fechamento</h2><dl className="mt-2 divide-y divide-[#d4dfeb]"><SourceValue label="Recebimentos na data" source={summary.receipts} currency /><SourceValue label="Sessões de caixa" source={summary.cash} /><SourceValue label="Despesas da data" source={summary.expenses} currency /><SourceValue label="Fechamento do dia" source={summary.closure} /></dl></section>
          </div>
        </div>
        {summary.warnings.length > 0 && <aside className={`${panel} bg-[#f4f8fc]`} aria-labelledby="day-warnings"><h2 id="day-warnings" className="font-bold">Pendências da apuração</h2><ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-[#45647f]">{summary.warnings.map((warning) => <li key={warning.code}>{warning.message}</li>)}</ul></aside>}
      </>}
      {tab === "passeios" && financialActorCpf ? <PainelTripDay date={summary.date} actorCpf={financialActorCpf} /> : tab === "passeios" && canAccessProgram ? <PainelCountingSummary date={summary.date} /> : null}
      {((tab === "passeios" && !financialActorCpf) || tab === "compras") && <DayListPanel key={`${summary.date}:${tab}`} date={summary.date} kind={tab === "passeios" ? "groups" : "purchases"} context={purchaseContext} onContextChange={updatePurchaseContext} canOperate={canAccessCash} />}
      {tab === "caixas" && <div className={`${panel} space-y-3`}><h2 className="text-lg font-bold">Caixas</h2><dl><SourceValue label="Sessões de caixa" source={summary.cash} /></dl><p>Caixas abertos e fechados por local nesta data. O saldo em caixa não compõe a receita da visita.</p>{canAccessCash ? <Link className="inline-flex min-h-11 items-center underline" href={`/painel/caixas?date=${summary.date}`}>Abrir caixas da data</Link> : <p>Seu perfil não permite acessar os caixas.</p>}</div>}
      {tab === "fechamento" && <div className={`${panel} space-y-3`}><h2 className="text-lg font-bold">Fechamento do dia</h2><p>{summary.closure.reason}</p><p className="text-sm text-[#45647f]">O subtotal disponível no resumo é parcial e não constitui um fechamento.</p></div>}
    </section>
    <p className="text-xs text-[#45647f]">Consultado em <time dateTime={summary.generatedAt}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(summary.generatedAt))}</time> (horário de São Paulo).</p>
  </div>;
}
