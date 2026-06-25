const defaultTokenEndpoint =
  "https://mpi.braspag.com.br/api/public/v1/access-token";

type Cielo3dsConfig = {
  clientId: string;
  clientSecret: string;
  establishmentCode: string;
  merchantName: string;
  mcc: string;
  tokenEndpoint: string;
  environment: string;
  debug: boolean;
  timeoutMs: number;
};

type CachedToken = {
  accessToken: string;
  tokenType: string;
  expiresAt: number;
};

export type Cielo3dsTokenData = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  environment: string;
  debug: boolean;
};

let cachedToken: CachedToken | null = null;

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  return ["1", "true", "on", "yes", "sim", "s"].includes(
    value.trim().toLowerCase(),
  );
}

function readRequiredEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

function getConfig(): Cielo3dsConfig | null {
  const clientId = readRequiredEnv("INGRESSO_CIELO_3DS_CLIENT_ID");
  const clientSecret = readRequiredEnv("INGRESSO_CIELO_3DS_CLIENT_SECRET");
  const establishmentCode = readRequiredEnv(
    "INGRESSO_CIELO_3DS_ESTABLISHMENT_CODE",
  );
  const merchantName = readRequiredEnv("INGRESSO_CIELO_3DS_MERCHANT_NAME");
  const mcc = readRequiredEnv("INGRESSO_CIELO_3DS_MCC");

  if (
    !clientId ||
    !clientSecret ||
    !establishmentCode ||
    !merchantName ||
    !mcc
  ) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    establishmentCode,
    merchantName,
    mcc,
    tokenEndpoint:
      process.env.INGRESSO_CIELO_3DS_TOKEN_ENDPOINT?.trim() ||
      defaultTokenEndpoint,
    environment:
      process.env.INGRESSO_CIELO_3DS_ENVIRONMENT?.trim().toUpperCase() || "PRD",
    debug: parseBoolean(process.env.INGRESSO_CIELO_3DS_DEBUG, false),
    timeoutMs: Number(process.env.INGRESSO_CIELO_3DS_TIMEOUT_MS ?? 30000),
  };
}

function getCachedToken() {
  const now = Date.now();

  if (!cachedToken || cachedToken.expiresAt <= now + 30_000) {
    return null;
  }

  return {
    accessToken: cachedToken.accessToken,
    tokenType: cachedToken.tokenType,
    expiresIn: Math.max(Math.floor((cachedToken.expiresAt - now) / 1000), 0),
  };
}

function extractErrorMessage(payload: unknown, status: number) {
  if (payload && typeof payload === "object") {
    const object = payload as Record<string, unknown>;

    if (typeof object.error_description === "string") {
      return object.error_description.trim();
    }

    if (typeof object.message === "string") {
      return object.message.trim();
    }

    if (typeof object.error === "string") {
      return object.error.trim();
    }
  }

  return `HTTP ${status}`;
}

async function requestNewToken(config: Cielo3dsConfig) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const response = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(
        `${config.clientId}:${config.clientSecret}`,
      ).toString("base64")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      EstablishmentCode: config.establishmentCode,
      MerchantName: config.merchantName,
      MCC: config.mcc,
    }),
    cache: "no-store",
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload || typeof payload !== "object") {
    throw new Error(
      `Falha ao obter token 3DS: ${extractErrorMessage(payload, response.status)}`,
    );
  }

  const accessToken =
    typeof payload.access_token === "string" ? payload.access_token.trim() : "";
  const tokenType =
    typeof payload.token_type === "string" ? payload.token_type.trim() : "Bearer";
  const rawExpiresIn =
    typeof payload.expires_in === "number"
      ? payload.expires_in
      : Number(payload.expires_in ?? 0);

  if (!accessToken) {
    throw new Error(
      `Falha ao obter token 3DS: ${extractErrorMessage(payload, response.status)}`,
    );
  }

  const expiresIn = Number.isFinite(rawExpiresIn) ? rawExpiresIn : 0;
  const ttlSeconds = expiresIn > 60 ? expiresIn - 60 : expiresIn;
  const expiresAt = Date.now() + Math.max(ttlSeconds, 60) * 1000;

  cachedToken = {
    accessToken,
    tokenType,
    expiresAt,
  };

  return {
    accessToken,
    tokenType,
    expiresIn: Math.max(Math.floor((expiresAt - Date.now()) / 1000), 0),
  };
}

export function isCielo3dsConfigured() {
  return getConfig() !== null;
}

export async function getCielo3dsTokenData(): Promise<Cielo3dsTokenData> {
  const config = getConfig();

  if (!config) {
    throw new Error("Credenciais da Cielo 3DS nao configuradas.");
  }

  const cached = getCachedToken();
  const token = cached ?? (await requestNewToken(config));

  return {
    ...token,
    environment: config.environment,
    debug: config.debug,
  };
}

export function resetCielo3dsTokenCacheForTests() {
  cachedToken = null;
}
