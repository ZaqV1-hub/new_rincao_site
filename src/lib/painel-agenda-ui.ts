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

export function buildPainelAgendaCalendar(month: number, year: number) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const previousMonthDays = new Date(year, month - 1, 0).getDate();
  const cells: CalendarCell[] = [];

  for (let offset = firstDay - 1; offset >= 0; offset -= 1) {
    const day = previousMonthDays - offset;
    const date = new Date(year, month - 2, day);

    cells.push({
      key: `prev-${day}`,
      date: date.toISOString().slice(0, 10),
      day,
      inMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month - 1, day);

    cells.push({
      key: `current-${day}`,
      date: date.toISOString().slice(0, 10),
      day,
      inMonth: true,
    });
  }

  let nextMonthDay = 1;

  while (cells.length % 7 !== 0) {
    const date = new Date(year, month, nextMonthDay);

    cells.push({
      key: `next-${nextMonthDay}`,
      date: date.toISOString().slice(0, 10),
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
