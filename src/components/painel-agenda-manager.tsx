"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  type PainelAgendaDayDetail,
  type PainelAgendaMonthEntry,
  type PainelAgendaScreenData,
} from "@/lib/painel-agenda";
import {
  buildPainelAgendaCalendar,
  formatPainelAgendaDateLabel,
  formatPainelAgendaMonthLabel,
} from "@/lib/painel-agenda-ui";

type PainelAgendaManagerProps = {
  data: PainelAgendaScreenData;
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
    return "border-[#d9e3eb] bg-white text-[#a9b8c4]";
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

  return "border-[#8dc72b] bg-[#8dc72b] text-white";
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

function getSelectedDayCardClasses(entry: AgendaToneInput | undefined) {
  if (!entry) {
    return "border-[#d9e3eb] bg-[#f7fafc] text-[#345062]";
  }

  if (entry.status === "lot") {
    return "border-[#f2b1b6] bg-[#fff3f4] text-[#8f1e26]";
  }

  if (entry.status === "fec") {
    return "border-[#bfd0de] bg-[#eef4f8] text-[#24455d]";
  }

  if (entry.type === "promo") {
    return "border-[#ffd0c0] bg-[#fff4ef] text-[#9f4420]";
  }

  return "border-[#cfe7a1] bg-[#f6fbeb] text-[#355824]";
}

function buildQuery(month: number, year: number, selectedDate?: string | null) {
  const params = new URLSearchParams();
  params.set("mes", String(month));
  params.set("ano", String(year));

  if (selectedDate) {
    params.set("dia", selectedDate);
  }

  return params.toString();
}

function buildAgendaHref(
  month: number,
  year: number,
  selectedDate?: string | null,
) {
  const query = buildQuery(month, year, selectedDate ? null : undefined);

  if (selectedDate) {
    return `/painel/agenda/${selectedDate}?${query}`;
  }

  return `/painel/agenda?${query}`;
}

function buildAgendaAddHref(
  month: number,
  year: number,
  selectedDate?: string | null,
) {
  const params = new URLSearchParams();
  params.set("mes", String(month));
  params.set("ano", String(year));

  if (selectedDate) {
    params.set("dia", selectedDate);
  }

  return `/painel/agenda/adicionar?${params.toString()}`;
}

function buildAgendaDayApiHref(selectedDate: string) {
  const params = new URLSearchParams();
  params.set("date", selectedDate);

  return `/api/painel/agenda?${params.toString()}`;
}

type SelectedDayResponse = {
  ok: true;
  data: PainelAgendaDayDetail;
};

type SelectedDayErrorResponse = {
  ok: false;
  error?: {
    code?: string;
    message?: string;
  };
};

async function readResponseBody<T>(response: Response) {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function PainelAgendaManager({ data }: PainelAgendaManagerProps) {
  const entriesByDate = useMemo(
    () => new Map(data.entries.map((entry) => [entry.date, entry])),
    [data.entries],
  );
  const calendarCells = useMemo(
    () => buildPainelAgendaCalendar(data.month, data.year),
    [data.month, data.year],
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(data.selectedDate);
  const [selectedDay, setSelectedDay] = useState<PainelAgendaDayDetail | null>(
    data.selectedDay,
  );
  const [loadingDate, setLoadingDate] = useState<string | null>(null);
  const [selectedDayError, setSelectedDayError] = useState<string | null>(null);
  const [dayCache, setDayCache] = useState<Record<string, PainelAgendaDayDetail>>(() =>
    data.selectedDate && data.selectedDay ? { [data.selectedDate]: data.selectedDay } : {},
  );
  const requestSequenceRef = useRef(0);
  const selectedAgenda = selectedDay?.agenda ?? null;
  const previousMonth = addMonths(data.month, data.year, -1);
  const nextMonth = addMonths(data.month, data.year, 1);
  const isDayLoading = loadingDate === selectedDate;
  const selectedVoucherCount = selectedDay?.vouchers.length ?? 0;

  async function handleDateSelection(nextSelectedDate: string) {
    if (nextSelectedDate === selectedDate) {
      return;
    }

    setSelectedDate(nextSelectedDate);
    setSelectedDayError(null);

    if (typeof window !== "undefined") {
      window.history.replaceState(
        null,
        "",
        buildAgendaHref(data.month, data.year, nextSelectedDate),
      );
    }

    if (dayCache[nextSelectedDate]) {
      setSelectedDay(dayCache[nextSelectedDate]);
      setLoadingDate(null);
      return;
    }

    setSelectedDay(null);
    setLoadingDate(nextSelectedDate);
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;

    try {
      const response = await fetch(buildAgendaDayApiHref(nextSelectedDate), {
        cache: "no-store",
      });
      const payload = await readResponseBody<
        SelectedDayResponse | SelectedDayErrorResponse
      >(response);

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload && !payload.ok
            ? payload.error?.message || "Nao foi possivel carregar o dia."
            : "Nao foi possivel carregar o dia.",
        );
      }

      if (requestSequenceRef.current !== requestSequence) {
        return;
      }

      setDayCache((current) => ({
        ...current,
        [nextSelectedDate]: payload.data,
      }));
      setSelectedDay(payload.data);
    } catch (error) {
      if (requestSequenceRef.current !== requestSequence) {
        return;
      }

      console.error("painel-agenda-day-selection-failed", error);
      setSelectedDayError("Nao foi possivel carregar o dia agora.");
    } finally {
      if (requestSequenceRef.current === requestSequence) {
        setLoadingDate(null);
      }
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-[1120px] gap-3">
      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,700px)_280px]">
        <section className="panel-section p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="panel-eyebrow">Agenda</p>
              <h1 className="mt-1 text-[28px] font-black leading-none text-[#17351f]">
                {formatPainelAgendaMonthLabel(data.month, data.year)}
              </h1>
            </div>

            <Link
              href={buildAgendaAddHref(data.month, data.year, selectedDate)}
              className="rounded-[8px] border border-[#d7e3d2] px-3 py-2 text-xs font-semibold text-[#275330] hover:bg-[#f7fbf5]"
            >
              Adicionar data padrao
            </Link>
          </div>

          <div className="mt-3 overflow-hidden rounded-[14px] border border-[#dbe7d7]">
            <div className="grid grid-cols-[40px_1fr_40px] items-center bg-[linear-gradient(135deg,#1f6b36,#7bc043)] text-white">
              <Link
                href={buildAgendaHref(previousMonth.month, previousMonth.year)}
                className="flex h-10 items-center justify-center text-[1.35rem] font-semibold hover:bg-white/10"
              >
                {"<"}
              </Link>
              <div className="text-center text-[1.1rem] font-semibold">
                {formatPainelAgendaMonthLabel(data.month, data.year)}
              </div>
              <Link
                href={buildAgendaHref(nextMonth.month, nextMonth.year)}
                className="flex h-10 items-center justify-center text-[1.35rem] font-semibold hover:bg-white/10"
              >
                {">"}
              </Link>
            </div>

            <div className="grid grid-cols-7 border-b border-[#dbe7d7] bg-[#17351f] text-center text-[13px] font-semibold text-white">
              {["D", "S", "T", "Q", "Q", "S", "S"].map((label, index) => (
                <div key={`${label}-${index}`} className="px-2 py-2">
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 bg-[#edf3f7] p-1">
              {calendarCells.map((cell) => {
                const entry = entriesByDate.get(cell.date);
                const active = cell.date === selectedDate;
                const classes = `min-h-[58px] rounded-[10px] border px-2 py-1.5 text-left transition hover:opacity-95 ${getAgendaToneClasses(
                  entry,
                  active,
                )}`;

                if (!cell.inMonth) {
                  return (
                    <div key={cell.key} className={classes}>
                      <div className="text-sm font-semibold">{cell.day}</div>
                    </div>
                  );
                }

                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => void handleDateSelection(cell.date)}
                    disabled={loadingDate === cell.date}
                    className={`${classes} disabled:cursor-wait disabled:opacity-80`}
                  >
                    <div className="text-sm font-semibold">{cell.day}</div>
                    {entry ? (
                      <div className="mt-1 text-[9px] leading-3.5">
                        <div>{entry.typeLabel}</div>
                        <div>{entry.statusLabel}</div>
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-[#4f6472]">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-[#8dc72b]" />
              Padrao
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-[#ff6138]" />
              Promocional
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-[#c90011]" />
              Data esgotada
            </div>
          </div>
        </section>

        <section className="panel-section p-3.5 xl:sticky xl:top-5">
          <div>
            <p className="panel-eyebrow">Dia selecionado</p>
            <h2 className="mt-1 text-[24px] font-black leading-none text-[#17351f]">
              {selectedDate
                ? formatPainelAgendaDateLabel(selectedDate)
                : "Selecione um dia"}
            </h2>
          </div>

          {isDayLoading ? (
            <div className="mt-3 rounded-[12px] border border-dashed border-[#d7e3d2] bg-[#f7fbf5] px-4 py-4 text-sm text-[#5d745f]">
              Carregando dados do dia...
            </div>
          ) : null}

          {selectedDayError ? (
            <div className="mt-3 rounded-[12px] border border-[#efc3c3] bg-[#fff3f1] px-4 py-3 text-sm text-[#9f3f36]">
              {selectedDayError}
            </div>
          ) : null}

          {selectedAgenda ? (
            <div
              className={`mt-3 rounded-[12px] border p-3 text-sm ${getSelectedDayCardClasses(
                selectedAgenda,
              )}`}
            >
              <div className="grid gap-x-4 gap-y-2">
                <div>
                  <span className="font-semibold">Tipo:</span> {selectedAgenda.typeLabel}
                </div>
                <div>
                  <span className="font-semibold">Status:</span> {selectedAgenda.statusLabel}
                </div>
                <div>
                  <span className="font-semibold">Passaportes vendidos:</span>{" "}
                  {selectedVoucherCount}
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {selectedDate ? (
              <Link
                href={`/painel/agenda/${selectedDate}/editar?mes=${data.month}&ano=${data.year}`}
                className="rounded-[8px] bg-[#2b8c46] px-3 py-2 text-sm font-semibold text-white"
              >
                Editar dia
              </Link>
            ) : (
              <Link
                href={buildAgendaAddHref(data.month, data.year, data.selectedDate)}
                className="rounded-[8px] bg-[#2b8c46] px-3 py-2 text-sm font-semibold text-white"
              >
                Adicionar data padrao
              </Link>
            )}
          </div>
          <p className="mt-3 text-xs leading-5 text-[#5d745f]">
            Datas promocionais e eventos devem ser criados na area de Site.
          </p>
        </section>
      </div>

      {selectedDay && selectedDay.vouchers.length > 0 ? (
        <section className="panel-section p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="panel-eyebrow">Vouchers do dia</p>
              <h2 className="mt-1 text-[24px] font-black text-[#17351f]">
                {formatPainelAgendaDateLabel(selectedDay.selectedDate)}
              </h2>
            </div>
            <div className="text-sm text-[#5d745f]">
              {selectedDay.vouchers.length} voucher(s)
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full overflow-hidden rounded-[12px] border border-[#dbe7d7] text-sm">
              <thead className="bg-[#f7fbf5] text-left text-[#35503b]">
                <tr>
                  <th className="px-3 py-2.5 text-xs font-semibold">Compra</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">Usuario</th>
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
                    <td className="px-3 py-3 font-semibold text-[#17351f]">
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
                    <td className="px-3 py-3">{voucher.used ? "Sim" : "Nao"}</td>
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
