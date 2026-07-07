import { formatCpf, sanitizeCpf } from "@/lib/cpf";

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

export function formatPainelCompraCpfFilterInput(value: unknown) {
  return formatCpf(String(value ?? ""));
}

export function buildPainelCompraFilterSearchParams(
  entries: Iterable<[string, FormDataEntryValue]>,
) {
  const params = new URLSearchParams();

  for (const [name, rawValue] of entries) {
    const value = String(rawValue ?? "").trim();

    if (
      !value ||
      value === "-1" ||
      value.toLowerCase() === "undefined" ||
      value.toLowerCase() === "null"
    ) {
      continue;
    }

    if (name === "cpf") {
      const cpf = sanitizeCpf(value);

      if (cpf) {
        params.set("cpf", cpf);
      }

      continue;
    }

    if (name === "idcompra") {
      const purchaseId = value.replace(/\D+/g, "");

      if (purchaseId) {
        params.set("idcompra", purchaseId);
      }

      continue;
    }

    params.set(name, value);
  }

  return params;
}
