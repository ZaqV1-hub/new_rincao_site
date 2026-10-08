import { loadConfirmedPurchase } from "@/lib/ticket-purchase-eligibility";
import { TicketSendResult } from "@/lib/ticket-service-contract";
import { getConfig, shouldSkipTicketServiceError, digitsOnly } from "@/lib/ticket-service-config";
import { ticketRequest, authenticate } from "@/lib/ticket-service-transport";
import { loadPendingTicketVouchers, markVouchersSent } from "@/lib/ticket-service-queries";
import { buildTicketPayload } from "@/lib/ticket-service-payload";

export async function processConfirmedPurchaseTickets(
  purchaseId: number,
): Promise<TicketSendResult> {
  const config = getConfig();

  if (!config) {
    return {
      status: "skipped",
      purchaseId,
      sentVoucherIds: [],
      skippedReason: "ticket_service_not_configured",
    };
  }

  const purchase = await loadConfirmedPurchase(purchaseId);

  if (!purchase) {
    return {
      status: "skipped",
      purchaseId,
      sentVoucherIds: [],
      skippedReason: "purchase_not_confirmed",
    };
  }

  const normalizedPhone = digitsOnly(purchase.celular);
  const normalizedEmail = String(purchase.email ?? "").trim();

  if (purchase.tpcompra === "ponli" && !normalizedPhone && !normalizedEmail) {
    return {
      status: "skipped",
      purchaseId,
      sentVoucherIds: [],
      skippedReason: "contact_missing_for_delivery",
    };
  }

  const vouchers = await loadPendingTicketVouchers(purchaseId);

  if (vouchers.length === 0) {
    return {
      status: "skipped",
      purchaseId,
      sentVoucherIds: [],
      skippedReason: "no_pending_vouchers",
    };
  }

  let token: string | null;

  try {
    token = await authenticate(config);
  } catch (error) {
    if (shouldSkipTicketServiceError(config, error)) {
      return {
        status: "skipped",
        purchaseId,
        sentVoucherIds: [],
        skippedReason: "ticket_service_unreachable",
      };
    }

    throw error;
  }

  if (!token) {
    return {
      status: "skipped",
      purchaseId,
      sentVoucherIds: [],
      skippedReason: "ticket_auth_failed",
    };
  }

  const regularVouchers = vouchers.filter((voucher) => voucher.tpvoucher !== "escol");
  const schoolVouchers = vouchers.filter((voucher) => voucher.tpvoucher === "escol");
  const sentVoucherIds: number[] = [];

  if (regularVouchers.length > 0) {
    try {
      await ticketRequest(
        config,
        "/generate-and-send-tickets",
        {
          vouchers: buildTicketPayload(purchase, regularVouchers),
          email: purchase.email,
          nmusuario: purchase.nmusuario,
        },
        token,
        [200, 202],
      );
    } catch (error) {
      if (shouldSkipTicketServiceError(config, error)) {
        return {
          status: "skipped",
          purchaseId,
          sentVoucherIds: [],
          skippedReason: "ticket_service_unreachable",
        };
      }

      throw error;
    }
    sentVoucherIds.push(...regularVouchers.map((voucher) => voucher.idvoucher));
  }

  for (const voucher of schoolVouchers) {
    try {
      await ticketRequest(
        config,
        "/send-school-ticket-message",
        {
          email: purchase.email,
          cellphone: purchase.celular,
        },
        token,
      );
    } catch (error) {
      if (shouldSkipTicketServiceError(config, error)) {
        return {
          status: "skipped",
          purchaseId,
          sentVoucherIds: [],
          skippedReason: "ticket_service_unreachable",
        };
      }

      throw error;
    }
    sentVoucherIds.push(voucher.idvoucher);
  }

  await markVouchersSent(sentVoucherIds);

  return {
    status: "sent",
    purchaseId,
    sentVoucherIds,
  };
}
