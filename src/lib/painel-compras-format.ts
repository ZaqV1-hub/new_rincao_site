function readSingleValue(value: unknown) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const normalized = String(entry ?? "").trim();

      if (
        normalized &&
        normalized !== "-1" &&
        normalized.toLowerCase() !== "undefined" &&
        normalized.toLowerCase() !== "null"
      ) {
        return normalized;
      }
    }

    return "";
  }

  return String(value ?? "").trim();
}

function normalizeScalar(value: unknown) {
  const normalized = readSingleValue(value);
  return normalized && normalized !== "-1" ? normalized : null;
}

function normalizeDateValue(value: unknown) {
  const normalized = readSingleValue(value);

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
