"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  type PainelAgendaMonthEntry,
  type PainelAgendaScreenData,
} from "@/lib/painel-agenda";
import {
  buildPainelAgendaCalendar,
  formatPainelAgendaDateLabel,
  formatPainelAgendaMonthLabel,
} from "@/lib/painel-agenda-ui";

import type { OperationalCalendarDay } from "@/lib/painel-operational-calendar";
import type { DayProgram } from "@/lib/day-program";
import type { OperationalDay } from "@/lib/operational-day";
import { isCivilDate } from "@/lib/operational-date";

type PainelAgendaManagerProps = {
  data: PainelAgendaScreenData;
  indicators?: OperationalCalendarDay[] | null;
  operationalDays: OperationalDay[] | null;
  operationalError?: string | null;
  today: string;
  canEdit: boolean;
  canAccessProgram?: boolean;
  programStatuses?: Record<string, DayProgram["status"]> | null;
  programError?: string | null;
};

type AgendaToneInput = Pick<PainelAgendaMonthEntry, "status" | "type">;

function addMonths(month: number, year: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);

  return {
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
}

function formatMoney(value: string | null) {
  if (!value) {
    return "-";
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return "-";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numeric);
}

function getAgendaBaseToneClasses(entry?: AgendaToneInput) {
  if (!entry) {
    return "border-dashed border-[#d9e3ee] bg-transparent text-[#6a7c92]";
  }

  if ((entry.type !== "padra" && entry.type !== "promo") || entry.status === "fec") {
    return "border-[#d9e3ee] bg-white text-[#0f2d52]";
  }

  return "border-2 border-[#2f6fb2] bg-[#eaf2fb] text-[#0f2d52]";
}

export function getAgendaToneClasses(
  entry: AgendaToneInput | undefined,
  active: boolean,
) {
  const baseClasses = getAgendaBaseToneClasses(entry);

  if (!active) {
    return baseClasses;
  }

  return `${baseClasses} ring-2 ring-[#2f6fb2] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.38)]`;
}

function buildAgendaHref(month: number, year: number, date?: string | null) {
  return `/painel/agenda${date ? `/${date}` : ""}?mes=${month}&ano=${year}`;
}

export function groupAgendaEntries(entries: PainelAgendaMonthEntry[]) {
  const grouped = new Map<string, PainelAgendaMonthEntry[]>();
  for (const entry of entries) grouped.set(entry.date, [...(grouped.get(entry.date) ?? []), entry]);
  return grouped;
}

export function canSelectAgendaDate(date: string, today: string, day?: OperationalDay) {
  return isCivilDate(date) && date >= today && !day?.closed;
}

class AgendaPriceBatchError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function applyAgendaPriceSelection(
  selectedDates: string[], days: OperationalDay[], priceTableId: number, reason: string, today: string,
): Promise<OperationalDay[]> {
  const byDate = new Map(days.map((day) => [day.date, day]));
  if (!selectedDates.length || selectedDates.some((date) => !canSelectAgendaDate(date, today, byDate.get(date)))) {
    throw new Error("Uma das datas selecionadas não pode ser alterada. Atualize a programação.");
  }
  if (!Number.isSafeInteger(priceTableId) || priceTableId < 1 || !reason.trim()) throw new Error("Selecione a tabela e informe o motivo.");
  const response = await fetch("/api/painel/dias", {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dates: selectedDates.map((date) => ({ date, version: byDate.get(date)?.version ?? null })), priceTableId, reason: reason.trim() }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new AgendaPriceBatchError(payload?.error?.message || "Não foi possível aplicar a tabela. Sua seleção foi mantida.", response.status);
  return payload.data;
}

const control = "min-h-11 rounded-lg border border-[#b8cbdc] px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#236699] disabled:opacity-50";
const isDayUse = (entry: PainelAgendaMonthEntry) => entry.type === "padra" || entry.type === "promo";

export function EmptyAgendaDateDialog({ date, canEdit, canAccessClients, onClose }: { date: string; canEdit: boolean; canAccessClients: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="empty-agenda-title" aria-describedby="empty-agenda-description" className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-xl border border-[#d9e3ee] bg-white p-6 text-[#0f2d52] backdrop:bg-[#0f2d52]/40">
    <h2 id="empty-agenda-title" className="text-xl font-bold">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))}</h2>
    <p id="empty-agenda-description" className="mt-3 text-sm text-[#6a7c92]">Ainda não há nada aberto nesta data.</p>
    <div className="mt-4 divide-y divide-[#e8eef5] rounded-lg border border-[#d9e3ee] px-4">
      {canEdit && <div className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0 flex-1"><h3 className="font-semibold">Abrir Day Use</h3><p className="mt-1 text-sm text-[#6a7c92]">Ingressos e serviços adicionais à venda no site e nos caixas</p></div><Link className={`${control} inline-flex items-center bg-[#133a62] text-white`} href={`/painel/agenda/${date}/editar`}>Abrir</Link></div>}
      {canAccessClients && <div className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0 flex-1"><h3 className="font-semibold">Agendar passeio de grupo</h3><p className="mt-1 text-sm text-[#6a7c92]">Feito pelo cadastro do cliente</p></div><Link className={`${control} inline-flex items-center`} href="/painel/clientes">Ir para clientes</Link></div>}
    </div>
    <button type="button" className={`${control} mt-4`} onClick={onClose}>Cancelar</button>
  </dialog>;
}

export function PainelAgendaManager({ data, indicators = null, operationalDays, operationalError, today, canEdit, canAccessProgram = false, programStatuses = null, programError }: PainelAgendaManagerProps) {
  const entriesByDate = useMemo(() => groupAgendaEntries(data.entries), [data.entries]);
  const calendarCells = useMemo(() => buildPainelAgendaCalendar(data.month, data.year), [data.month, data.year]);
  const [days, setDays] = useState(operationalDays);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [priceTableId, setPriceTableId] = useState("");
  const [reason, setReason] = useState("");
  const [emptyDate, setEmptyDate] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const daysByDate = new Map((days ?? []).map((day) => [day.date, day]));
  const indicatorsByDate = new Map((indicators ?? []).map(day => [day.date, day]));
  const selectedDate = data.selectedDate;
  const previousMonth = addMonths(data.month, data.year, -1);
  const nextMonth = addMonths(data.month, data.year, 1);
  const writable = canEdit && days !== null;

  async function applyPrices(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!days || busy || conflict) return;
    setBusy(true); setFeedback(null);
    try {
      const updated = await applyAgendaPriceSelection(selectedDates, days, Number(priceTableId), reason, today);
      setDays((current) => [...(current ?? []).filter((day) => !updated.some((item) => item.date === day.date)), ...updated]);
      setSelectedDates([]);
      setReason("");
      setFeedback({ error: false, text: `Tabela aplicada a ${updated.length} data(s).` });
    } catch (error) {
      setConflict(error instanceof AgendaPriceBatchError && error.status === 409);
      setFeedback({ error: true, text: error instanceof Error ? error.message : "Não foi possível aplicar a tabela. Sua seleção foi mantida." });
    } finally { setBusy(false); }
  }

  async function reloadConfiguration() {
    setBusy(true);
    try {
      const inMonth = calendarCells.filter((cell) => cell.inMonth);
      const params = new URLSearchParams({ startDate: inMonth[0].date, endDate: inMonth[inMonth.length - 1].date });
      const response = await fetch(`/api/painel/dias?${params}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Não foi possível atualizar a programação.");
      setDays(payload.data);
      setConflict(false);
      setFeedback({ error: false, text: "Programação atualizada. Confira as datas e a tabela antes de aplicar novamente." });
    } catch (error) {
      setFeedback({ error: true, text: error instanceof Error ? error.message : "Não foi possível atualizar. Sua seleção foi mantida." });
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-4 text-[#123b63]">
      <div className="grid items-start gap-4 ">
        <section className="panel-section min-w-0 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-widest text-[#4e6e92]">Agenda</p><h1 className="mt-1 text-[28px] font-bold text-[#0f2d52]">Agenda do parque</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[#6a7c92]">Tudo começa aqui. Entre numa data para ver o relatório, os passeios, as compras, os caixas e o fechamento. Numa data vazia você abre o day use.</p></div>
            <Link href={buildAgendaHref(Number(today.slice(5, 7)), Number(today.slice(0, 4)), today)} className={`${control} hover:bg-[#eef4fb]`}>Ir para hoje</Link>
          </div>

          {days === null ? (
            <div role="alert" className="mt-4 rounded-lg border border-[#d6b272] bg-[#fff9ed] p-3 text-sm text-[#694812]">
              <p className="font-semibold">Programação indisponível</p>
              <p>{operationalError || "Não foi possível consultar as configurações. Atualize antes de alterar datas."}</p>
              <button type="button" onClick={() => void reloadConfiguration()} disabled={busy} className={`${control} mt-2`}>Atualizar programação</button>
            </div>
          ) : null}
          {canAccessProgram && programStatuses === null && <p role="alert" className="mt-4 text-sm text-[#694812]">{programError || "Programação do dia indisponível. Atualize a página para tentar novamente."}</p>}
          {indicators === null && <p role="alert" className="mt-4 text-sm text-[#694812]">Indicadores da agenda indisponíveis. Atualize a página para tentar novamente.</p>}
          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 text-[#0f2d52]"><nav className="flex items-center gap-2 sm:gap-3" aria-label="Mês da agenda">
              <Link aria-label="Mês anterior" href={buildAgendaHref(previousMonth.month, previousMonth.year)} className="flex min-h-11 min-w-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#123b63]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
              </Link>
              <h2 className="min-w-32 text-center text-[17px] font-semibold sm:min-w-40">{formatPainelAgendaMonthLabel(data.month, data.year)}</h2>
              <Link aria-label="Próximo mês" href={buildAgendaHref(nextMonth.month, nextMonth.year)} className="flex min-h-11 min-w-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#123b63]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
              </Link>
              </nav>
          <fieldset className="flex flex-wrap overflow-hidden rounded-lg border border-[#d9e3ee]">
            <legend className="sr-only">Filtrar datas</legend>
            {[["all", "Todas"], ["dayuse", "Day use"], ["groups", "Grupos"], ["pending", "Fechamento pendente"]].map(([value, label]) => (
              <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-11 border-r border-[#d9e3ee] px-3 text-[13px] font-medium last:border-r-0 focus-visible:outline-2 focus-visible:outline-[#2f6fb2] ${filter === value ? "bg-[#133a62] text-white" : "text-[#6a7c92] hover:bg-[#eaf2fb]"}`}>{label}</button>
            ))}
          </fieldset>
            </div>
            {writable && <p className="mb-3 text-[13px] text-[#6a7c92]">Marque o quadradinho no canto das datas para selecionar várias e trocar a tabela de preço de uma vez.</p>}
            <div className="hidden grid-cols-7 md:grid text-center text-[11px] font-bold uppercase tracking-widest text-[#4e6e92]">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((label) => <div key={label} className="py-2">{label}</div>)}
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-7">
              {calendarCells.map((cell) => {
                const entries = entriesByDate.get(cell.date) ?? [];
                const config = daysByDate.get(cell.date);
                const indicator = indicatorsByDate.get(cell.date);
                const dayUse = entries.find(isDayUse);
                const groups = entries.filter((entry) => !isDayUse(entry));
                const open = config ? config.dayUseOpen : dayUse?.status === "abe";
                const movement = Boolean(entries.length || config?.dayUseAgendaId || config?.closed || indicator?.closed || (indicator?.groupCount ?? 0) > 0 || indicator?.vehicleCount || indicator?.plannedPeople || indicator?.revenueCents || indicator?.closurePending);
                const matches = filter === "all" || (filter === "dayuse" ? Boolean(open) : filter === "pending" ? Boolean(indicator?.closurePending) : (indicator?.groupCount ?? groups.length) > 0);
                if (!cell.inMonth) return <div key={cell.key} aria-hidden="true" className="hidden md:block" />;
                const tone = open || (config ? config.onlineSoldOut : dayUse?.status === "lot") ? { status: "abe" as const, type: "padra" as const } : movement ? { status: "fec" as const, type: "padra" as const } : undefined;
                const dayClass = "flex min-h-[118px] w-full flex-col rounded-lg px-2 py-2 text-left text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f6fb2]";
                const programCreated = canAccessProgram && ["created", "exported", "past_created"].includes(programStatuses?.[cell.date] ?? "");
                return (
                  <div key={cell.key} className={`group relative min-w-0 rounded-[9px] border ${getAgendaToneClasses(tone, cell.date === selectedDate || selectedDates.includes(cell.date))} ${cell.date === today ? "shadow-[inset_0_0_0_2px_#e7b864]" : ""} ${!matches ? "opacity-30" : ""} ${movement ? "hover:shadow-[0_4px_14px_rgba(19,58,98,0.14)]" : "hover:border-[#2f6fb2]"}`}>
                    {movement || indicators === null || days === null ? <Link href={buildAgendaHref(data.month, data.year, cell.date)} aria-label={`Abrir ${formatPainelAgendaDateLabel(cell.date)}`} aria-current={cell.date === today ? "date" : undefined} className={dayClass}>
                      <span className="pr-8 text-sm font-bold tabular-nums">{cell.day}</span>
                      {indicator && movement && <><span className="mt-1 block text-[22px] font-extrabold leading-none tabular-nums">{indicator.plannedPeople === null ? <span className="text-xs font-medium leading-4">Previsão a preencher</span> : <>{indicator.plannedPeople}<span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-[#6a7c92]">pessoas</span></>}</span><span className="mt-1 block text-[11px] leading-4 text-[#6a7c92]">{indicator.groupCount === null ? "Passeios indisponíveis" : indicator.groupCount > 0 ? `${indicator.groupCount} ${indicator.groupCount === 1 ? "passeio" : "passeios"}` : "público geral"}{indicator.vehicleCount > 0 ? ` · ${indicator.vehicleCount} veíc.` : ""}</span>{indicator.revenueCents === null ? <span className="text-[11px]">Receita indisponível</span> : indicator.revenueCents > 0 && <span className="mt-0.5 text-[11px] font-semibold tabular-nums">{formatMoney(String(indicator.revenueCents / 100))}</span>}</>}
                      {!indicator && groups.length > 0 && <span className="mt-1 text-[11px]">{`${groups.length} ${groups.length === 1 ? "passeio" : "passeios"}`}</span>}
                      <span className="mt-auto flex flex-wrap gap-1 pt-2 text-[9px] font-bold">
                        {cell.date === today && <span className="rounded bg-[#e7b864] px-1.5 py-0.5 text-[#3a2606]">Hoje</span>}
                        {open && <span className="rounded bg-[#2f6fb2] px-1.5 py-0.5 text-white">Day use</span>}
                        {(config ? config.onlineSoldOut : dayUse?.status === "lot") && <span className="rounded bg-[#fff1cf] px-1.5 py-0.5 text-[#8a5a00]">Esgotado</span>}
                        {!open && (dayUse || config?.dayUseAgendaId) && !config?.closed && <span className="rounded bg-[#e6ecf3] px-1.5 py-0.5 text-[#5c6f86]">Day use fechado</span>}
                        {(config?.closed || indicator?.closed) && <span className="rounded bg-[#e3f4e9] px-1.5 py-0.5 text-[#1f7440]">Fechado</span>}
                        {indicator?.counting && <span className="rounded bg-[#fff1cf] px-1.5 py-0.5 text-[#8a5a00]">Contando</span>}
                        {indicator?.closurePending && <span className="rounded bg-[#fff1cf] px-1.5 py-0.5 text-[#8a5a00]">Fechamento pendente</span>}
                        {programCreated && <span title="Dia seguinte criado" className="rounded bg-[#fceadb] px-1.5 py-0.5 text-[#9a4a12]">Dia seg.</span>}
                      </span>
                    </Link> : cell.date >= today ? <button type="button" aria-label={`Abrir opções de ${formatPainelAgendaDateLabel(cell.date)}`} aria-haspopup="dialog" onClick={() => setEmptyDate(cell.date)} className={dayClass}>
                      <span className="pr-8 text-sm font-semibold tabular-nums text-[#6a7c92]">{cell.day}</span>
                      <span className="mt-auto text-xs font-semibold text-[#2f6fb2] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">{writable ? "+ Abrir day use" : "Ver opções"}</span>
                    </button> : <div className={dayClass}><span className="text-sm tabular-nums text-[#6a7c92]">{cell.day}</span></div>}

                    {writable && canSelectAgendaDate(cell.date, today, config) ? (
                      <label className="absolute right-0 top-0 flex min-h-11 w-11 cursor-pointer items-center justify-center">
                        <input type="checkbox" aria-label={`Selecionar ${formatPainelAgendaDateLabel(cell.date)}`} checked={selectedDates.includes(cell.date)} disabled={busy} onChange={(event) => setSelectedDates((current) => event.target.checked ? [...current, cell.date].sort() : current.filter((date) => date !== cell.date))} className="h-4 w-4 accent-[#123b63] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#123b63]" />
                      </label>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#6a7c92]" aria-label="Legenda da agenda">
            <span className="inline-flex items-center gap-2"><i aria-hidden="true" className="h-3.5 w-3.5 rounded border-2 border-[#2f6fb2] bg-[#eaf2fb]" />Day use aberto</span>
            <span className="inline-flex items-center gap-2"><i aria-hidden="true" className="h-3.5 w-3.5 rounded border border-[#d9e3ee] bg-white" />Só grupos</span>
            <span className="inline-flex items-center gap-2"><i aria-hidden="true" className="h-3.5 w-3.5 rounded border border-dashed border-[#d9e3ee]" />Sem nada aberto</span>
            <span className="inline-flex items-center gap-2"><i aria-hidden="true" className="h-3.5 w-3.5 rounded shadow-[inset_0_0_0_2px_#e7b864]" />Hoje</span>
            {canAccessProgram && <span className="inline-flex items-center gap-2"><i aria-hidden="true" className="h-3.5 w-3.5 rounded bg-[#fceadb]" />Dia seguinte criado</span>}
          </div>
          {selectedDates.length > 0 ? (
            <form onSubmit={(event) => void applyPrices(event)} className="mt-4 grid gap-3 border-t border-[#d4dfeb] pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{selectedDates.length} data(s) selecionada(s)</strong>
                <button type="button" disabled={busy} onClick={() => setSelectedDates([])} className={`${control} hover:bg-[#eef4fb]`}>Limpar seleção</button>
              </div>
              <label className="grid gap-1 text-sm font-semibold">
                Tabela de preço
                <select required value={priceTableId} disabled={busy} onChange={(event) => setPriceTableId(event.target.value)} className={`${control} w-full bg-white`}>
                  <option value="">Selecione uma tabela</option>
                  {data.priceTables.map((table) => <option key={table.id} value={table.id}>{table.label}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold">
                Motivo da alteração
                <input required maxLength={1000} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} className={`${control} w-full bg-white`} />
              </label>
              <button type="submit" disabled={busy || conflict || !priceTableId || !reason.trim()} className={`${control} bg-[#123b63] text-white hover:bg-[#174e7e]`}>{busy ? "Salvando…" : "Aplicar tabela às datas"}</button>
              {conflict ? <button type="button" disabled={busy} onClick={() => void reloadConfiguration()} className={`${control} hover:bg-[#eef4fb]`}>Atualizar programação mantendo a seleção</button> : null}
            </form>
          ) : null}
          {feedback ? <p role={feedback.error ? "alert" : "status"} className={`mt-4 rounded-lg border p-3 text-sm ${feedback.error ? "border-[#e3b8b2] bg-[#fff4f2] text-[#913c30]" : "border-[#a9cfb7] bg-[#eef8f1] text-[#245b37]"}`}>{feedback.text}</p> : null}
        </section>
      </div>
      {emptyDate && <EmptyAgendaDateDialog date={emptyDate} canAccessClients={canAccessProgram} canEdit={Boolean(writable && canSelectAgendaDate(emptyDate, today, daysByDate.get(emptyDate)))} onClose={() => setEmptyDate(null)} />}
    </div>
  );
}
