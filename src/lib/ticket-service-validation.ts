import { TicketValidationAction, TicketValidationPair, TicketValidationSyncResult } from "@/lib/ticket-service-contract";
import { getConfig, shouldSkipTicketServiceError } from "@/lib/ticket-service-config";
import { ticketRequest, authenticate } from "@/lib/ticket-service-transport";
import { loadTicketValidationVoucher } from "@/lib/ticket-service-queries";
import { buildValidationTicketPayload } from "@/lib/ticket-service-payload";

export async function syncTicketValidation(
  pairs: TicketValidationPair[],
  action: TicketValidationAction,
): Promise<TicketValidationSyncResult> {
  const normalizedPairs = Array.from(
    new Set(
      pairs
        .filter(
          (pair) =>
            Number.isInteger(pair.purchaseId) &&
            pair.purchaseId > 0 &&
            Number.isInteger(pair.voucherId) &&
            pair.voucherId > 0,
        )
        .map((pair) => `${pair.purchaseId}-${pair.voucherId}`),
    ),
  ).map((pair) => {
    const [purchaseId, voucherId] = pair.split("-").map(Number);

    return { purchaseId, voucherId };
  });

  if (normalizedPairs.length === 0) {
    return {
      status: "skipped",
      action,
      pairs: [],
      skippedReason: "no_ticket_pairs",
    };
  }

  const config = getConfig();

  if (!config) {
    return {
      status: "skipped",
      action,
      pairs: normalizedPairs.map(
        (pair) => `${pair.purchaseId}-${pair.voucherId}`,
      ),
      skippedReason: "ticket_service_not_configured",
    };
  }

  let token: string | null;

  try {
    token = await authenticate(config);
  } catch (error) {
    if (shouldSkipTicketServiceError(config, error)) {
      return {
        status: "skipped",
        action,
        pairs: normalizedPairs.map(
          (pair) => `${pair.purchaseId}-${pair.voucherId}`,
        ),
        skippedReason: "ticket_service_unreachable",
      };
    }

    throw error;
  }

  if (!token) {
    return {
      status: "skipped",
      action,
      pairs: normalizedPairs.map(
        (pair) => `${pair.purchaseId}-${pair.voucherId}`,
      ),
      skippedReason: "ticket_auth_failed",
    };
  }

  for (const pair of normalizedPairs) {
    const payload: Record<string, unknown> = {
      id: `${pair.purchaseId}-${pair.voucherId}`,
      action,
    };

    if (config.testing) {
      payload.isTesting = "true";
    }

    if (action === "validate") {
      const voucher = await loadTicketValidationVoucher(
        pair.purchaseId,
        pair.voucherId,
      );

      if (!voucher) {
        return {
          status: "skipped",
          action,
          pairs: normalizedPairs.map(
            (currentPair) => `${currentPair.purchaseId}-${currentPair.voucherId}`,
          ),
          skippedReason: "ticket_validation_payload_missing",
        };
      }

      payload.ticket = buildValidationTicketPayload(voucher);
    }

    try {
      await ticketRequest(config, "/tickets/validate", payload, token);
    } catch (error) {
      if (shouldSkipTicketServiceError(config, error)) {
        return {
          status: "skipped",
          action,
          pairs: normalizedPairs.map(
            (currentPair) => `${currentPair.purchaseId}-${currentPair.voucherId}`,
          ),
          skippedReason: "ticket_service_unreachable",
        };
      }

      throw error;
    }
  }

  return {
    status: "sent",
    action,
    pairs: normalizedPairs.map(
      (pair) => `${pair.purchaseId}-${pair.voucherId}`,
    ),
  };
}
