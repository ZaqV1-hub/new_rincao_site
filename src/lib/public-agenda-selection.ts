import type { PublicAgendaEvent } from "@/lib/agenda-contracts";

export function parseSelectedAgendaId(value: string | null | undefined) {
  const agendaId = Number(value);

  if (!Number.isInteger(agendaId) || agendaId <= 0) {
    return null;
  }

  return agendaId;
}

export function resolveSelectedAgendaId(
  events: PublicAgendaEvent[],
  value: string | null | undefined,
  selectedDate?: string | null,
) {
  const requestedAgendaId = parseSelectedAgendaId(value);

  if (requestedAgendaId) {
    return events.some((event) => event.id === requestedAgendaId)
      ? requestedAgendaId
      : null;
  }

  if (selectedDate) {
    return events.find((event) => event.date === selectedDate)?.id ?? null;
  }

  return null;
}

export function buildPublicAgendaSelectionHref(
  month: number,
  year: number,
  agendaId: number,
) {
  return `/agenda?mes=${month}&ano=${year}&agendaId=${agendaId}`;
}

export function buildPublicAgendaPurchaseHref(event: PublicAgendaEvent) {
  return `/comprar/${event.legacyEncodedId}`;
}
