"use client";

import {
  FlowIcon,
  FlowStepper,
  IconBubble,
  PrimaryFlowButton,
} from "@/components/order-flow-ui";
import type {
  BffErrorResponse,
  PublicAgendaEvent,
  PublicAgendaMonth,
  PublicAgendaResponse,
} from "@/lib/agenda-contracts";
import {
  buildPublicAgendaPurchaseHref,
  buildPublicAgendaSelectionHref,
} from "@/lib/public-agenda-selection";
import Link from "next/link";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";

const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

const selectedDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const weekdayLabels = [
  { key: "sun", label: "D" },
  { key: "mon", label: "S" },
  { key: "tue", label: "T" },
  { key: "wed", label: "Q" },
  { key: "thu", label: "Q" },
  { key: "fri", label: "S" },
  { key: "sat", label: "S" },
];

type PublicAgendaProps = {
  initialMonth: number;
  initialYear: number;
  availableMonths: PublicAgendaMonth[];
  initialEvents: PublicAgendaEvent[];
  initialError?: string;
  initialSelectedAgendaId?: number | null;
};

type LoadState =
  | { status: "loading"; events: PublicAgendaEvent[]; error?: undefined }
  | { status: "ready"; events: PublicAgendaEvent[]; error?: undefined }
  | { status: "error"; events: PublicAgendaEvent[]; error: string };

type CalendarDay = {
  key: string;
  day: number;
  inMonth: boolean;
};

function getMonthLabel(month: number, year: number) {
  const label = monthFormatter.format(new Date(year, month - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getMonthKey(month: number, year: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function buildCalendarDays(month: number, year: number) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const previousMonthDays = new Date(year, month - 1, 0).getDate();
  const days: CalendarDay[] = [];

  for (let offset = firstDay - 1; offset >= 0; offset -= 1) {
    days.push({
      key: `prev-${previousMonthDays - offset}`,
      day: previousMonthDays - offset,
      inMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push({
      key: `current-${day}`,
      day,
      inMonth: true,
    });
  }

  let nextMonthDay = 1;

  while (days.length % 7 !== 0) {
    days.push({
      key: `next-${nextMonthDay}`,
      day: nextMonthDay,
      inMonth: false,
    });
    nextMonthDay += 1;
  }

  return days;
}

function formatSelectedDate(event: PublicAgendaEvent) {
  return selectedDateFormatter.format(new Date(`${event.date}T12:00:00`));
}

function isPromotionalEvent(event: PublicAgendaEvent | null | undefined) {
  return event?.type === "promo";
}

function updateUrl(
  month: number,
  year: number,
  selectedAgendaId?: number | null,
) {
  const url = new URL(window.location.href);
  url.searchParams.set("mes", String(month));
  url.searchParams.set("ano", String(year));

  if (selectedAgendaId) {
    url.searchParams.set("agendaId", String(selectedAgendaId));
  } else {
    url.searchParams.delete("agendaId");
  }

  window.history.replaceState(null, "", url);
}

function isSameMonth(month: number, year: number, now: Date) {
  return month === now.getMonth() + 1 && year === now.getFullYear();
}

export function PublicAgenda({
  initialMonth,
  initialYear,
  availableMonths,
  initialEvents,
  initialError,
  initialSelectedAgendaId = null,
}: PublicAgendaProps) {
  const initialPeriodKey = useRef(`${initialYear}-${initialMonth}`);
  const [period, setPeriod] = useState({
    month: initialMonth,
    year: initialYear,
  });
  const [selectedEventId, setSelectedEventId] = useState<number | null>(
    initialSelectedAgendaId,
  );
  const [state, setState] = useState<LoadState>(
    initialError
      ? { status: "error", events: [], error: initialError }
      : { status: "ready", events: initialEvents },
  );

  useEffect(() => {
    updateUrl(period.month, period.year, selectedEventId);
  }, [period.month, period.year, selectedEventId]);

  useEffect(() => {
    const periodKey = `${period.year}-${period.month}`;

    if (initialPeriodKey.current === periodKey) {
      initialPeriodKey.current = "";
      return;
    }

    const controller = new AbortController();

    async function loadAgenda() {
      setState((current) => ({
        status: "loading",
        events: current.events,
      }));

      try {
        const response = await fetch(
          `/api/agenda/publica?mes=${period.month}&ano=${period.year}`,
          { signal: controller.signal },
        );
        const payload = (await response.json()) as
          | PublicAgendaResponse
          | BffErrorResponse;

        if (!response.ok || !payload.ok) {
          throw new Error(
            payload.ok
              ? "Não foi possível consultar a agenda."
              : payload.error.message,
          );
        }

        setState({
          status: "ready",
          events: payload.data.events,
        });
        setSelectedEventId(null);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: "error",
          events: [],
          error:
            error instanceof Error
              ? error.message
              : "Não foi possível consultar a agenda.",
        });
      }
    }

    loadAgenda();

    return () => controller.abort();
  }, [period.month, period.year]);

  const eventsByDay = useMemo(
    () => new Map(state.events.map((event) => [event.day, event])),
    [state.events],
  );
  const days = buildCalendarDays(period.month, period.year);
  const sortedEvents = [...state.events].sort((first, second) =>
    first.date.localeCompare(second.date),
  );
  const selectedEvent =
    sortedEvents.find((event) => event.id === selectedEventId) ?? null;
  const selectedDateLabel = selectedEvent ? formatSelectedDate(selectedEvent) : "";
  const now = new Date();
  const currentMonthIndex = availableMonths.findIndex(
    (item) => item.month === period.month && item.year === period.year,
  );
  const previousPeriod =
    currentMonthIndex > 0 ? availableMonths[currentMonthIndex - 1] : null;
  const nextPeriod =
    currentMonthIndex >= 0 && currentMonthIndex < availableMonths.length - 1
      ? availableMonths[currentMonthIndex + 1]
      : null;

  function changeMonth(next: PublicAgendaMonth) {
    if (
      getMonthKey(next.month, next.year) ===
      getMonthKey(period.month, period.year)
    ) {
      return;
    }

    startTransition(() => {
      setSelectedEventId(null);
      setPeriod({
        month: next.month,
        year: next.year,
      });
    });
  }

  return (
    <div className="min-h-[calc(100vh-58px)] pb-20 text-[#073f35] lg:pb-6">
      <div className="mx-auto w-[min(980px,calc(100%-16px))] py-3 sm:w-[min(980px,calc(100%-24px))] sm:py-4">
        <FlowStepper current="date" />

        {state.status === "error" ? (
          <div className="mt-5 rounded-[16px] border border-[#efc3c3] bg-[#fff3f1] px-4 py-3 text-left text-sm font-semibold text-[#9f3f36]">
            {state.error}
          </div>
        ) : null}

        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
          <section className="rounded-[14px] border border-[#dfe8dc] bg-white/86 p-3 text-left shadow-[0_10px_22px_rgba(18,52,45,0.045)] sm:p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#087842] lg:hidden">
              {getMonthLabel(period.month, period.year)}
            </p>
            <p className="hidden text-[10px] font-bold uppercase tracking-[0.24em] text-[#087842] lg:block">
              Agendamento
            </p>
            <h1 className="mt-2 max-w-[430px] text-[19px] font-extrabold leading-[1.06] text-[#073f35] sm:text-[25px] lg:text-[28px]">
              Escolha a data da visita
            </h1>
            <p className="mt-2 max-w-[430px] text-[12px] leading-[1.42] text-[#626469] sm:text-[13px] lg:text-[14px]">
              Selecione o dia em que você deseja visitar a Estância e Parque
              Ecológico das Águas.
            </p>

            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#cae6c5] bg-[#eef8ec] px-3 py-1 text-[#087842]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#18ac26]" />
                Data regular
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#f3c699] bg-[#fff3e8] px-3 py-1 text-[#b85c12]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ef8d32]" />
                Data promocional
              </span>
            </div>

            {selectedEvent ? (
              <div className="mt-3 flex max-w-[320px] items-center gap-2.5 rounded-[10px] border border-[#dce8d8] bg-white p-2.5 shadow-[0_8px_16px_rgba(18,52,45,0.035)]">
                <IconBubble name="calendar" className="h-8 w-8 sm:h-9 sm:w-9" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#087842]">
                    Dia da visita
                  </p>
                  <strong className="mt-0.5 block text-[14px] font-extrabold text-[#073f35] sm:text-[15px]">
                    {selectedDateLabel}
                  </strong>
                  {isPromotionalEvent(selectedEvent) ? (
                    <span className="mt-1 inline-flex rounded-full bg-[#fff3e8] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#b85c12]">
                      Promocional
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="mt-3 rounded-[12px] border border-[#dfe8dc] bg-white p-2 shadow-[0_10px_22px_rgba(18,52,45,0.04)] sm:p-3">
              <div className="grid grid-cols-[30px_1fr_30px] items-center gap-2 sm:grid-cols-[34px_1fr_34px]">
                <button
                  type="button"
                  aria-label="Mês anterior"
                  disabled={!previousPeriod}
                  onClick={() => previousPeriod && changeMonth(previousPeriod)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[#d8dfd7] bg-white text-[17px] font-black leading-none text-[#073f35] hover:border-[#073f35] disabled:cursor-not-allowed disabled:opacity-35 sm:h-8 sm:w-8"
                >
                  ‹
                </button>
                <h2 className="text-center text-[14px] font-extrabold text-[#073f35] sm:text-[16px] lg:text-[18px]">
                  {getMonthLabel(period.month, period.year)}
                </h2>
                <button
                  type="button"
                  aria-label="Próximo mês"
                  disabled={!nextPeriod}
                  onClick={() => nextPeriod && changeMonth(nextPeriod)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[#d8dfd7] bg-white text-[17px] font-black leading-none text-[#073f35] hover:border-[#073f35] disabled:cursor-not-allowed disabled:opacity-35 sm:h-8 sm:w-8"
                >
                  ›
                </button>
              </div>

              <div className="mt-2.5 grid grid-cols-7 gap-1 text-center sm:gap-1.5">
                {weekdayLabels.map((weekday) => (
                  <div
                    key={weekday.key}
                    className="py-0.5 text-[9px] font-bold text-[#073f35] sm:text-[10px]"
                  >
                    {weekday.label}
                  </div>
                ))}
              </div>

              <div className="mt-1 grid grid-cols-7 gap-1 text-center sm:gap-1.5">
                {days.map((day, index) => {
                  const event = day.inMonth ? eventsByDay.get(day.day) : null;
                  const isSelected = event?.id === selectedEventId;
                  const isToday =
                    day.inMonth &&
                    isSameMonth(period.month, period.year, now) &&
                    day.day === now.getDate();
                  const isPromotional = isPromotionalEvent(event);

                  if (!event || event.status === "lot") {
                    return (
                      <span
                        key={`${period.year}-${period.month}-${index}-${day.key}`}
                        className={`flex h-[32px] items-center justify-center rounded-[7px] border text-[10px] font-bold sm:h-[40px] sm:text-[12px] lg:h-[42px] ${
                          day.inMonth
                            ? "border-transparent bg-[#f4f2ed] text-[#9aa39a]"
                            : "border-[#ece9e2] bg-white text-[#b9b8b4]"
                        } ${isToday ? "ring-2 ring-[#b6d9ad]" : ""}`}
                      >
                        {day.day}
                      </span>
                    );
                  }

                  return (
                    <Link
                      key={`${period.year}-${period.month}-${index}-${day.key}`}
                      href={buildPublicAgendaSelectionHref(
                        period.month,
                        period.year,
                        event.id,
                      )}
                      onClick={() => setSelectedEventId(event.id)}
                      className={`flex h-[32px] items-center justify-center rounded-[7px] border text-[10px] font-bold transition sm:h-[40px] sm:text-[12px] lg:h-[42px] ${
                        isSelected
                          ? isPromotional
                            ? "border-[#ef8d32] bg-[#b85c12] text-white shadow-[0_10px_22px_rgba(184,92,18,0.2)]"
                            : "border-[#18ac26] bg-[#073f35] text-white shadow-[0_10px_22px_rgba(7,63,53,0.2)]"
                          : isPromotional
                            ? "border-[#f3c699] bg-[#fff3e8] text-[#b85c12] hover:border-[#ef8d32]"
                            : "border-[#cae6c5] bg-[#eef8ec] text-[#087842] hover:border-[#18ac26]"
                      } ${isToday ? "ring-2 ring-[#7fcf72]" : ""}`}
                    >
                      {day.day}
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="hidden h-fit rounded-[14px] border border-[#dfe8dc] bg-white/90 p-4 text-left shadow-[0_10px_22px_rgba(18,52,45,0.045)] lg:block">
            {state.status === "loading" ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#087842]">
                  Consultando
                </p>
                <h2 className="mt-2 text-[15px] font-extrabold leading-tight text-[#073f35]">
                  Carregando agenda
                </h2>
              </div>
            ) : null}

            {state.status !== "loading" && !selectedEvent ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#087842]">
                  Dia da visita
                </p>
                <h2 className="mt-2 text-[15px] font-extrabold leading-tight text-[#073f35]">
                  {sortedEvents.length > 0
                    ? "Escolha uma data disponível"
                    : "Não há eventos atuais"}
                </h2>
                {sortedEvents.length === 0 ? (
                  <p className="mt-2 text-[12px] leading-5 text-[#626469]">
                    No momento não existem datas abertas para compra ou
                    agendamento.
                  </p>
                ) : null}
              </div>
            ) : null}

            {selectedEvent ? (
              <div>
                <div className="flex items-center gap-3">
                  <IconBubble name="calendar" className="h-10 w-10" />
                  <div>
                    <p className="text-[13px] font-bold text-[#626469]">
                      Data selecionada
                    </p>
                    <strong className="mt-1 block text-[16px] font-extrabold leading-tight text-[#073f35]">
                      {selectedDateLabel}
                    </strong>
                    {isPromotionalEvent(selectedEvent) ? (
                      <span className="mt-2 inline-flex rounded-full bg-[#fff3e8] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#b85c12]">
                        Data promocional
                      </span>
                    ) : null}
                  </div>
                </div>

                {selectedEvent.promotional.name ? (
                  <div className="mt-4 rounded-[10px] border border-[#f3c699] bg-[#fff8ef] px-3 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#b85c12]">
                      Evento promocional
                    </p>
                    <h3 className="mt-1 text-[15px] font-extrabold leading-tight text-[#7a4213]">
                      {selectedEvent.promotional.name}
                    </h3>
                    {selectedEvent.promotional.description ? (
                      <p className="mt-2 text-[12px] leading-5 text-[#8a5a34]">
                        {selectedEvent.promotional.description}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <PrimaryFlowButton
                  href={buildPublicAgendaPurchaseHref(selectedEvent)}
                  className="mt-4 min-h-[40px] px-3 text-[12px] sm:text-[13px]"
                >
                  Continuar para passaportes
                </PrimaryFlowButton>
                <p className="mt-3 flex gap-2 text-[12px] leading-5 text-[#626469]">
                  <FlowIcon
                    name="leaf"
                    className="mt-1 h-4 w-4 shrink-0 text-[#20aa1f]"
                  />
                  Após escolher a data, você seguirá para a seleção de
                  passaportes.
                </p>
              </div>
            ) : null}
          </aside>
        </div>
      </div>

      {selectedEvent ? (
        <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-[16px] border border-[#e2e8df] bg-white/96 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-3 text-left shadow-[0_-10px_28px_rgba(18,52,45,0.11)] backdrop-blur lg:hidden">
          <div className="mb-3 flex items-center gap-3">
            <IconBubble name="calendar" className="h-9 w-9" />
            <div>
              <p className="text-[12px] font-bold text-[#626469]">
                Data selecionada
              </p>
              <strong className="block text-[14px] font-black text-[#073f35]">
                {selectedDateLabel}
              </strong>
              {isPromotionalEvent(selectedEvent) ? (
                <span className="mt-1 inline-flex rounded-full bg-[#fff3e8] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#b85c12]">
                  Promocional
                </span>
              ) : null}
            </div>
          </div>
          <PrimaryFlowButton
            href={buildPublicAgendaPurchaseHref(selectedEvent)}
            className="min-h-[42px] text-[13px] sm:text-[14px]"
          >
            Continuar para passaportes
          </PrimaryFlowButton>
        </div>
      ) : null}
    </div>
  );
}
