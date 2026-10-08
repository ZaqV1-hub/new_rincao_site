export function formatDateLabel(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function parseSchoolValueInput(raw: string) {
  const trimmed = raw.trim();

  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  const numeric = Number(normalized);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return numeric;
}

export function normalizeMoney(value: number) {
  return value.toFixed(2);
}

