import { createHmac, timingSafeEqual } from "node:crypto";

export type ClientTripPlinkPayload = {
  idagenda: number;
  idcliente: number;
  tipo: string;
  ver: 1;
};

function getPlinkSecret() {
  const explicit = process.env.INGRESSO_PLINK_SECRET?.trim();

  if (explicit) {
    return explicit;
  }

  const sessionSecret = process.env.INGRESSO_BFF_SESSION_SECRET?.trim();

  if (sessionSecret) {
    return sessionSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("INGRESSO_PLINK_SECRET must be configured");
  }

  return "local-rincao-plink-secret";
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", getPlinkSecret()).update(value).digest("base64url");
}

function safeEqual(first: string, second: string) {
  const left = Buffer.from(first);
  const right = Buffer.from(second);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function normalizeClientTripTypeSlug(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const aliases: Record<string, string> = {
    escola: "escola",
    igreja: "igreja",
    melhoridade: "melhoridade",
    "melhor-idade": "melhoridade",
    "grupo-melhor-idade": "melhoridade",
    grupomelhoridade: "melhoridade",
    "grupo-da-melhor-idade": "melhoridade",
    ongs: "ong",
    "ong-s": "ong",
    ong: "ong",
    "grupos-mistos": "confraternizacao",
    "grupo-misto": "confraternizacao",
    confraternizacoes: "confraternizacao",
    confraternizacaoes: "confraternizacao",
    confraternizacao: "confraternizacao",
    "confraternizacao-empresa": "confraternizacao",
    casamento: "casamento",
  };

  return aliases[normalized] ?? "";
}

export function createClientTripPlink(
  payload: Omit<ClientTripPlinkPayload, "ver">,
) {
  const normalizedType = normalizeClientTripTypeSlug(payload.tipo);

  if (!normalizedType) {
    throw new Error("invalid_client_trip_type");
  }

  const encodedPayload = base64UrlEncode(
    JSON.stringify({
      idagenda: Number(payload.idagenda),
      idcliente: Number(payload.idcliente),
      tipo: normalizedType,
      ver: 1,
    } satisfies ClientTripPlinkPayload),
  );

  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function buildClientTripPurchasePath(
  payload: Omit<ClientTripPlinkPayload, "ver">,
) {
  const normalizedType = normalizeClientTripTypeSlug(payload.tipo);

  if (normalizedType !== "escola") {
    return null;
  }

  const token = createClientTripPlink(payload);

  return `/ingresso/escola?plink=${encodeURIComponent(token)}`;
}

export function readClientTripPlink(
  token: string,
): ClientTripPlinkPayload | null {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature || !safeEqual(sign(encodedPayload), signature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      base64UrlDecode(encodedPayload),
    ) as Partial<ClientTripPlinkPayload>;
    const agendaId = parsed.idagenda;
    const clientId = parsed.idcliente;
    const normalizedType =
      typeof parsed.tipo === "string"
        ? normalizeClientTripTypeSlug(parsed.tipo)
        : "";

    if (
      !Number.isInteger(agendaId) ||
      !Number.isInteger(clientId) ||
      normalizedType === ""
    ) {
      return null;
    }

    return {
      idagenda: Number(agendaId),
      idcliente: Number(clientId),
      tipo: normalizedType,
      ver: 1,
    };
  } catch {
    return null;
  }
}
