function normalizeScalar(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized && normalized !== "-1" ? normalized : null;
}

function normalizeDateValue(value: unknown) {
  const normalized = String(value ?? "").trim();

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(normalized)) {
    return normalized;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [year, month, day] = normalized.split("-");
    return `${day}/${month}/${year}`;
  }

  return null;
}

export function normalizePainelCompraScalarFilterValue(value: unknown) {
  return normalizeScalar(value);
}

export function normalizePainelCompraDateFilterValue(value: unknown) {
  return normalizeDateValue(value);
}
