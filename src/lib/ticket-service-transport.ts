import { buildTicketsApiHeaders, getTicketsApiBaseUrl } from "@/lib/ticket-api";
import { TicketServiceConfig } from "@/lib/ticket-service-contract";
import { resolveTicketServiceBaseUrls, isRetryableTicketServiceError } from "@/lib/ticket-service-config";

export async function ticketRequest(
  config: TicketServiceConfig,
  path: string,
  body: unknown,
  token?: string,
  allowedStatuses: number[] = [200],
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (config.testing) {
    headers["X-Testing"] = "true";
  }

  const baseUrls = resolveTicketServiceBaseUrls(config);
  let lastError: unknown = null;

  for (const [index, baseUrl] of baseUrls.entries()) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok || !allowedStatuses.includes(response.status)) {
        throw new Error(`ticket_api_error_${response.status}`);
      }

      return response.json().catch(() => ({}));
    } catch (error) {
      lastError = error;

      if (
        index < baseUrls.length - 1 &&
        isRetryableTicketServiceError(error)
      ) {
        continue;
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("ticket_api_unreachable");
}

export async function websiteTicketRequest(
  path: string,
  body: unknown,
  allowedStatuses: number[] = [200, 202],
) {
  const baseUrl = getTicketsApiBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: buildTicketsApiHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok || !allowedStatuses.includes(response.status)) {
    throw new Error(`ticket_api_error_${response.status}`);
  }

  return {
    payload: await response.json().catch(() => ({})),
    status: response.status,
  };
}

export async function authenticate(config: TicketServiceConfig) {
  const response = await ticketRequest(config, "/login", {
    user: config.username,
    password: config.password,
  });
  const token =
    response && typeof response === "object"
      ? (response as Record<string, unknown>).token
      : null;

  return typeof token === "string" && token ? token : null;
}

