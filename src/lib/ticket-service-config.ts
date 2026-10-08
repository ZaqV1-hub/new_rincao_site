import { TicketServiceConfig } from "@/lib/ticket-service-contract";

export function getConfig(): TicketServiceConfig | null {
  const baseUrl = process.env.INGRESSO_TICKET_API_BASE_URL?.trim() ?? "";
  const username = process.env.INGRESSO_TICKET_API_USERNAME?.trim() ?? "";
  const password = process.env.INGRESSO_TICKET_API_PASSWORD?.trim() ?? "";
  const timeoutMs = Number(process.env.INGRESSO_TICKET_API_TIMEOUT_MS ?? 25000);
  const testing = process.env.INGRESSO_TICKET_API_TESTING === "true";

  if (baseUrl && username && password) {
    return {
      baseUrl: baseUrl.replace(/\/+$/, ""),
      username,
      password,
      testing,
      timeoutMs,
    };
  }

  if (
    process.env.NODE_ENV === "development" &&
    !baseUrl &&
    !username &&
    !password
  ) {
    return {
      baseUrl: "http://127.0.0.1:4120",
      username: "local-ticket-user",
      password: "local-ticket-pass",
      testing: true,
      timeoutMs,
    };
  }

  return null;
}

export function isTicketServiceConfigured() {
  return getConfig() !== null;
}

export function resolveLocalTestingBaseUrl(baseUrl: string) {
  try {
    const url = new URL(baseUrl);

    if (url.hostname !== "ticket-stub" && url.hostname !== "localhost") {
      return null;
    }

    url.hostname = "127.0.0.1";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export function resolveTicketServiceBaseUrls(config: TicketServiceConfig) {
  const baseUrls = [config.baseUrl];

  if (!config.testing) {
    return baseUrls;
  }

  const localTestingBaseUrl = resolveLocalTestingBaseUrl(config.baseUrl);

  if (localTestingBaseUrl && localTestingBaseUrl !== config.baseUrl) {
    baseUrls.push(localTestingBaseUrl);
  }

  if (!baseUrls.includes("http://127.0.0.1:4120")) {
    baseUrls.push("http://127.0.0.1:4120");
  }

  return baseUrls;
}

export function isRetryableTicketServiceError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const causeCode =
    error.cause && typeof error.cause === "object" && "code" in error.cause
      ? String((error.cause as { code?: unknown }).code ?? "")
      : "";
  const errorText = `${error.message} ${causeCode}`;

  return /(fetch failed|ENOTFOUND|ECONNREFUSED|EAI_AGAIN|ECONNRESET)/i.test(
    errorText,
  );
}

export function shouldSkipTicketServiceError(
  config: TicketServiceConfig,
  error: unknown,
) {
  return config.testing && isRetryableTicketServiceError(error);
}

export function digitsOnly(value: string | null | undefined) {
  return String(value ?? "").replace(/\D+/g, "");
}

export function normalizeWhatsappNumbers(value: string | undefined) {
  return String(value ?? "")
    .split(",")
    .map((entry) => digitsOnly(entry))
    .filter(Boolean);
}

export function validateWhatsappPhoneForEnvironment(phoneNumber: string) {
  if (process.env.INGRESSO_TICKET_API_WHATSAPP_TESTING !== "true") {
    return true;
  }

  const allowedNumbers = normalizeWhatsappNumbers(
    process.env.INGRESSO_TICKET_API_WHATSAPP_ALLOWED_NUMBERS,
  );

  if (allowedNumbers.length === 0 || allowedNumbers.includes(phoneNumber)) {
    return true;
  }

  return false;
}

export function isWebsiteTicketApiTesting() {
  return (
    process.env.TICKETS_API_TESTING_ENABLED === "true" ||
    process.env.INGRESSO_TICKET_API_TESTING === "true"
  );
}

export function toValidInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

