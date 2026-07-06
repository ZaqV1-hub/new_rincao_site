import type { PainelAgendaStatus, PainelAgendaType } from "@/lib/painel-agenda";

type CalendarCell = {
  key: string;
  date: string;
  day: number;
  inMonth: boolean;
};

const painelAgendaTypeLabels: Record<PainelAgendaType, string> = {
  padra: "Data padrão",
  promo: "Data promocional",
  escol: "Data escolar",
  igrej: "Igreja",
  casam: "Casamento",
  melho: "Melhor idade",
  confr: "Confraternização",
  ongs: "ONG",
  grmix: "Grupo misto",
};

const painelAgendaStatusLabels: Record<PainelAgendaStatus, string> = {
  abe: "Aberta",
  fec: "Fechada",
  lot: "Esgotada",
};

function buildDateOnlyValue(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function buildPainelAgendaCalendar(month: number, year: number) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const previousMonthDays = new Date(year, month - 1, 0).getDate();
  const cells: CalendarCell[] = [];

  for (let offset = firstDay - 1; offset >= 0; offset -= 1) {
    const day = previousMonthDays - offset;
    const previousMonth = month === 1 ? 12 : month - 1;
    const previousMonthYear = month === 1 ? year - 1 : year;

    cells.push({
      key: `prev-${day}`,
      date: buildDateOnlyValue(previousMonthYear, previousMonth, day),
      day,
      inMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      key: `current-${day}`,
      date: buildDateOnlyValue(year, month, day),
      day,
      inMonth: true,
    });
  }

  let nextMonthDay = 1;

  while (cells.length % 7 !== 0) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextMonthYear = month === 12 ? year + 1 : year;

    cells.push({
      key: `next-${nextMonthDay}`,
      date: buildDateOnlyValue(nextMonthYear, nextMonth, nextMonthDay),
      day: nextMonthDay,
      inMonth: false,
    });
    nextMonthDay += 1;
  }

  return cells;
}

export function formatPainelAgendaMonthLabel(month: number, year: number) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const label = formatter.format(new Date(year, month - 1, 1));

  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatPainelAgendaDateLabel(date: string) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return formatter.format(new Date(`${date}T12:00:00`));
}

export function getPainelAgendaTypeOptions(currentType?: PainelAgendaType | null) {
  if (currentType === "escol") {
    return [{ value: "escol", label: painelAgendaTypeLabels.escol }];
  }

  return (["padra", "promo"] as PainelAgendaType[]).map((value) => ({
    value,
    label: painelAgendaTypeLabels[value],
  }));
}

export function getPainelAgendaStatusOptions() {
  return (
    Object.entries(painelAgendaStatusLabels) as Array<[PainelAgendaStatus, string]>
  ).map(([value, label]) => ({ value, label }));
}
