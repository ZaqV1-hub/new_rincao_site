import type { PublicAgendaMonth } from "@/lib/agenda-contracts";

export function compareAgendaMonths(
  left: Pick<PublicAgendaMonth, "month" | "year">,
  right: Pick<PublicAgendaMonth, "month" | "year">,
) {
  if (left.year !== right.year) {
    return left.year - right.year;
  }

  return left.month - right.month;
}

export function buildAgendaMonthRange(
  start: Pick<PublicAgendaMonth, "month" | "year">,
  end: Pick<PublicAgendaMonth, "month" | "year">,
) {
  const months: PublicAgendaMonth[] = [];
  let currentMonth = start.month;
  let currentYear = start.year;

  while (
    currentYear < end.year ||
    (currentYear === end.year && currentMonth <= end.month)
  ) {
    months.push({
      month: currentMonth,
      year: currentYear,
    });

    currentMonth += 1;

    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear += 1;
    }
  }

  return months;
}

export function buildNavigableAgendaMonths(
  current: Pick<PublicAgendaMonth, "month" | "year">,
  availableMonths: PublicAgendaMonth[],
  requested?: Pick<PublicAgendaMonth, "month" | "year"> | null,
) {
  const latestAvailable = availableMonths.at(-1) ?? null;
  const candidates = [latestAvailable, requested].filter(
    (value): value is Pick<PublicAgendaMonth, "month" | "year"> => Boolean(value),
  );
  const end =
    candidates.length > 0
      ? candidates.reduce((latest, month) =>
          compareAgendaMonths(month, latest) > 0 ? month : latest,
        )
      : current;

  if (compareAgendaMonths(end, current) < 0) {
    return [current];
  }

  return buildAgendaMonthRange(current, end);
}

export function resolveAgendaMonthInRange(
  requested: Pick<PublicAgendaMonth, "month" | "year"> | null,
  navigableMonths: PublicAgendaMonth[],
) {
  if (!requested) {
    return navigableMonths[0] ?? null;
  }

  const exactMatch = navigableMonths.find(
    (item) => item.month === requested.month && item.year === requested.year,
  );

  if (exactMatch) {
    return exactMatch;
  }

  const nextAvailable = navigableMonths.find(
    (item) => compareAgendaMonths(item, requested) >= 0,
  );

  if (nextAvailable) {
    return nextAvailable;
  }

  return navigableMonths.at(-1) ?? null;
}
