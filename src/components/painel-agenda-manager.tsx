"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import {
  type PainelAgendaMonthEntry,
  type PainelAgendaScreenData,
} from "@/lib/painel-agenda";
import {
  buildPainelAgendaCalendar,
  formatPainelAgendaDateLabel,
  formatPainelAgendaMonthLabel,
} from "@/lib/painel-agenda-ui";

import type { OperationalDay } from "@/lib/operational-day";
import { isCivilDate } from "@/lib/operational-date";

type PainelAgendaManagerProps = {
  data: PainelAgendaScreenData;
  operationalDays: OperationalDay[] | null;
  operationalError?: string | null;
  today: string;
  canEdit: boolean;
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
    return "border-[#d9e3eb] bg-white text-[#45647f]";
  }

  if (entry.status === "lot") {
    return "border-[#c90011] bg-[#c90011] text-white";
  }

  if (entry.status === "fec") {
    return "border-[#90a9bd] bg-[#dce8f2] text-[#24455d]";
  }

  if (entry.type === "promo") {
    return "border-[#ff6138] bg-[#ff6138] text-white";
  }

  return "border-[#84bd00] bg-[#84bd00] text-[#17351f]";
}

export function getAgendaToneClasses(
  entry: AgendaToneInput | undefined,
  active: boolean,
) {
  const baseClasses = getAgendaBaseToneClasses(entry);

  if (!active) {
    return baseClasses;
  }

  return `${baseClasses} ring-2 ring-[#17351f] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.38)]`;
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

export function PainelAgendaManager({ data, operationalDays, operationalError, today, canEdit }: PainelAgendaManagerProps) {
  const entriesByDate = useMemo(() => groupAgendaEntries(data.entries), [data.entries]);
  const calendarCells = useMemo(() => buildPainelAgendaCalendar(data.month, data.year), [data.month, data.year]);
  const [days, setDays] = useState(operationalDays);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [priceTableId, setPriceTableId] = useState("");
  const [reason, setReason] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const daysByDate = new Map((days ?? []).map((day) => [day.date, day]));
  const selectedDate = data.selectedDate;
  const selectedDay = data.selectedDay;
  const selectedEntries = selectedDate ? entriesByDate.get(selectedDate) ?? [] : [];
  const selectedConfig = selectedDate ? daysByDate.get(selectedDate) : undefined;
  const selectedDayUse = selectedEntries.find(isDayUse);
  const selectedPriceId = selectedConfig?.priceTableId ?? selectedDayUse?.priceTableId;
  const previousMonth = addMonths(data.month, data.year, -1);
  const nextMonth = addMonths(data.month, data.year, 1);
  const tableName = (id: number) => data.priceTables.find((table) => table.id === id)?.label ?? `Tabela ${id}`;
  const writable = canEdit && days !== null;
  const selectedEditable = writable && selectedDate && canSelectAgendaDate(selectedDate, today, selectedConfig);

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
    <div className="mx-auto grid w-full max-w-[1120px] gap-4 text-[#123b63]">
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="panel-section min-w-0 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold">Agenda</h1>
            <Link href={buildAgendaHref(Number(today.slice(5, 7)), Number(today.slice(0, 4)), today)} className={`${control} hover:bg-[#eef4fb]`}>Ir para hoje</Link>
          </div>
          <fieldset className="mt-4 flex flex-wrap gap-2">
            <legend className="sr-only">Filtrar datas</legend>
            {[["all", "Todas"], ["dayuse", "Day use"], ["groups", "Grupos"]].map(([value, label]) => (
              <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`${control} ${filter === value ? "bg-[#123b63] text-white" : "hover:bg-[#eef4fb]"}`}>{label}</button>
            ))}
          </fieldset>
          {days === null ? (
            <div role="alert" className="mt-4 rounded-lg border border-[#d6b272] bg-[#fff9ed] p-3 text-sm text-[#694812]">
              <p className="font-semibold">Programação indisponível</p>
              <p>{operationalError || "Não foi possível consultar as configurações. Atualize antes de alterar datas."}</p>
              <button type="button" onClick={() => void reloadConfiguration()} disabled={busy} className={`${control} mt-2`}>Atualizar programação</button>
            </div>
          ) : null}
          <div className="mt-4 overflow-hidden rounded-xl border border-[#d4dfeb]">
            <div className="grid grid-cols-[44px_1fr_44px] items-center bg-[#eef4fb] text-[#123b63]">
              <Link aria-label="Mês anterior" href={buildAgendaHref(previousMonth.month, previousMonth.year)} className="flex min-h-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#123b63]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
              </Link>
              <h2 className="text-center text-base font-semibold">{formatPainelAgendaMonthLabel(data.month, data.year)}</h2>
              <Link aria-label="Próximo mês" href={buildAgendaHref(nextMonth.month, nextMonth.year)} className="flex min-h-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#123b63]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
              </Link>
            </div>
            <div className="grid grid-cols-7 bg-[#eef4fb] text-center text-xs font-semibold">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((label) => <div key={label} className="py-2">{label}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1 bg-[#edf3f7] p-1">
              {calendarCells.map((cell) => {
                const entries = entriesByDate.get(cell.date) ?? [];
                const config = daysByDate.get(cell.date);
                const dayUse = entries.find(isDayUse);
                const groups = entries.filter((entry) => !isDayUse(entry));
                const open = config ? config.dayUseOpen : dayUse?.status === "abe";
                const matches = filter === "all" || (filter === "dayuse" ? Boolean(dayUse || config?.dayUseAgendaId) : groups.length > 0);
                if (!cell.inMonth || !matches) return <div key={cell.key} className="min-h-24 px-2 py-2 text-xs text-[#60758d]">{cell.day}</div>;
                const tone = config?.closed ? { status: "fec" as const, type: "padra" as const } : config?.dayUseAgendaId ? { status: config.onlineSoldOut ? "lot" as const : open ? "abe" as const : "fec" as const, type: dayUse?.type ?? "padra" as const } : dayUse;
                return (
                  <div key={cell.key} className={`min-w-0 rounded-lg border ${getAgendaToneClasses(tone, cell.date === selectedDate || selectedDates.includes(cell.date))}`}>
                    <Link href={buildAgendaHref(data.month, data.year, cell.date)} aria-label={`Abrir ${formatPainelAgendaDateLabel(cell.date)}`} aria-current={cell.date === today ? "date" : undefined} className="block min-h-24 rounded-lg px-1 py-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#123b63] sm:px-2">
                      <span className="text-sm font-bold tabular-nums">{cell.day}</span>
                      {cell.date === today ? <span className="block text-[10px] font-bold">Hoje</span> : null}
                      <span className="mt-1 block break-words text-[10px] leading-4 sm:text-xs">
                        {config?.closed ? <span className="block font-semibold">Dia finalizado</span> : null}
                        {dayUse || config?.dayUseAgendaId ? <span className="block">
                          <span className="whitespace-nowrap sm:hidden">{(config ? Boolean(config.onlineSoldOut) : dayUse?.status === "lot") ? "Lotado" : open ? "Aberto" : "Fechado"}</span>
                          <span className="hidden sm:inline">{(config ? Boolean(config.onlineSoldOut) : dayUse?.status === "lot") ? "Day use esgotado" : open ? "Day use aberto" : "Day use fechado"}</span>
                        </span> : null}
                        {groups.length > 0 ? <span className="block">{`${groups.length} agenda${groups.length === 1 ? "" : "s"} de grupos`}</span> : null}
                        {config?.priceTableId ? <span className="block truncate" title={tableName(config.priceTableId)}>{tableName(config.priceTableId)}</span> : null}
                      </span>
                    </Link>
                    {writable && canSelectAgendaDate(cell.date, today, config) ? (
                      <label className="flex min-h-11 cursor-pointer items-center justify-center border-t border-current/20">
                        <input type="checkbox" aria-label={`Selecionar ${formatPainelAgendaDateLabel(cell.date)}`} checked={selectedDates.includes(cell.date)} disabled={busy} onChange={(event) => setSelectedDates((current) => event.target.checked ? [...current, cell.date].sort() : current.filter((date) => date !== cell.date))} className="h-4 w-4 accent-[#123b63] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#123b63]" />
                      </label>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          {writable ? <p className="mt-3 text-xs leading-5 text-[#45647f]">Marque datas de hoje em diante para trocar a tabela de preço. Dias finalizados ficam somente para consulta.</p> : null}
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

        <section className="panel-section min-w-0 p-4 xl:sticky xl:top-5">
          <h2 className="text-xl font-bold">{selectedDate ? formatPainelAgendaDateLabel(selectedDate) : "Selecione uma data"}</h2>
          {selectedDate ? <>
            <p className="mt-3 text-sm">{selectedConfig?.closed ? "Dia finalizado" : (selectedConfig ? Boolean(selectedConfig.onlineSoldOut) : selectedDayUse?.status === "lot") ? "Day use aberto · vendas esgotadas" : selectedConfig?.dayUseOpen || (!selectedConfig && selectedDayUse?.status === "abe") ? "Day use aberto" : "Day use fechado"}</p>
            <div className="mt-4 border-t border-[#d4dfeb] pt-3">
              <p className="text-sm text-[#45647f]">Tabela de preço da data</p>
              <p className="mt-1 font-semibold">{selectedPriceId ? tableName(selectedPriceId) : "Nenhuma tabela definida"}</p>
            </div>
            {selectedEntries.length ? (
              <ul className="mt-4 space-y-2 text-sm">
                {selectedEntries.map((entry) => (
                  <li key={entry.id}>{entry.typeLabel} · {isDayUse(entry) && selectedConfig ? selectedConfig.dayUseOpen ? "Aberta" : "Fechada" : entry.statusLabel}</li>
                ))}
              </ul>
            ) : <p className="mt-4 text-sm text-[#45647f]">Nenhuma agenda cadastrada nesta data.</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={buildAgendaHref(data.month, data.year, selectedDate)} className={`${control} hover:bg-[#eef4fb]`}>Abrir página do dia</Link>
              {selectedEditable ? (
                <Link href={`/painel/agenda/${selectedDate}/editar?mes=${data.month}&ano=${data.year}`} className={`${control} bg-[#123b63] text-white hover:bg-[#174e7e]`}>
                  {selectedConfig?.dayUseAgendaId || selectedDayUse ? "Editar day use" : "Abrir day use"}
                </Link>
              ) : null}
            </div>
          </> : <p className="mt-3 text-sm leading-6 text-[#45647f]">Abra uma data no calendário para consultar a programação, os grupos e os vouchers.</p>}
        </section>
      </div>

      {selectedDay && selectedDay.vouchers.length > 0 ? (
        <section className="panel-section p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#45647f]">Vouchers do dia</p>
              <h2 className="mt-1 text-[24px] font-black text-[#123b63]">
                {formatPainelAgendaDateLabel(selectedDay.selectedDate)}
              </h2>
            </div>
            <div className="text-sm text-[#60758d]">
              {selectedDay.vouchers.length} voucher(s)
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full overflow-hidden rounded-[12px] border border-[#d4dfeb] text-sm">
              <thead className="bg-[#eef4fb] text-left text-[#123b63]">
                <tr>
                  <th className="px-3 py-2.5 text-xs font-semibold">Compra</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">Usuário</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">Telefone</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">Celular</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">E-mail</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">Voucher</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">Tipo</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">Valor</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">Data de uso</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">Usado?</th>
                </tr>
              </thead>
              <tbody>
                {selectedDay.vouchers.map((voucher, index) => (
                  <tr
                    key={`${voucher.purchaseId}-${voucher.voucherNumber}-${index}`}
                    className={index % 2 === 0 ? "bg-white" : "bg-[#f8fbfd]"}
                  >
                    <td className="px-3 py-3 font-semibold text-[#123b63]">
                      {voucher.purchaseId}
                    </td>
                    <td className="px-3 py-3">{voucher.customerName || "-"}</td>
                    <td className="px-3 py-3">{voucher.phone || "-"}</td>
                    <td className="px-3 py-3">{voucher.mobile || "-"}</td>
                    <td className="px-3 py-3">{voucher.email || "-"}</td>
                    <td className="px-3 py-3">{voucher.voucherNumber || "-"}</td>
                    <td className="px-3 py-3">{voucher.voucherTypeLabel || "-"}</td>
                    <td className="px-3 py-3">{formatMoney(voucher.unitValue)}</td>
                    <td className="px-3 py-3">
                      {voucher.useDate
                        ? formatPainelAgendaDateLabel(voucher.useDate)
                        : "-"}
                    </td>
                    <td className="px-3 py-3">{voucher.used ? "Sim" : "Não"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
