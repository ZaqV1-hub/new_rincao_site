import { Buffer } from "node:buffer";

export function encodeLegacyId(id: number) {
  return Buffer.from(String(id), "utf8").toString("base64");
}

function normalizeAgendaIdValue(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseAgendaId(value: string) {
  const normalizedValue = normalizeAgendaIdValue(value);

  if (/^\d+$/.test(normalizedValue)) {
    return Number(normalizedValue);
  }

  try {
    const decoded = Buffer.from(normalizedValue, "base64").toString("utf8");

    if (/^\d+$/.test(decoded)) {
      return Number(decoded);
    }
  } catch {
    return null;
  }

  return null;
}
