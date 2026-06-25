export function formatPainelBilheteriaMoney(
  value: string | number | null | undefined,
) {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric)) {
    return "R$ 0,00";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numeric);
}

export function formatPainelBilheteriaCpf(
  value: string | null | undefined,
) {
  const digits = String(value ?? "").replace(/\D+/g, "");

  if (digits.length !== 11) {
    return value || "-";
  }

  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function formatPainelBilheteriaDate(
  value: string | null | undefined,
) {
  const normalized = String(value ?? "").slice(0, 10);

  if (!normalized) {
    return "-";
  }

  const [year, month, day] = normalized.split("-");

  return year && month && day ? `${day}/${month}/${year}` : normalized;
}
