import { loadConfirmedPurchase } from "@/lib/ticket-purchase-eligibility";
import { TicketWhatsappSendResult } from "@/lib/ticket-service-contract";
import { getConfig, isRetryableTicketServiceError, digitsOnly, validateWhatsappPhoneForEnvironment, isWebsiteTicketApiTesting } from "@/lib/ticket-service-config";
import { authenticate, ticketRequest, websiteTicketRequest } from "@/lib/ticket-service-transport";
import { loadSelectedTicketVouchers } from "@/lib/ticket-service-queries";
import { buildTicketPayload } from "@/lib/ticket-service-payload";

export async function sendPurchaseTicketsWhatsApp(
  purchaseId: number,
  voucherIds: number[],
  phoneNumber: string,
  requestId?: string,
): Promise<TicketWhatsappSendResult> {
  const normalizedPhone = digitsOnly(phoneNumber);

  if (normalizedPhone.length < 11) {
    return {
      status: "skipped",
      purchaseId,
      sentVoucherIds: [],
      skippedReason: "invalid_phone_number",
    };
  }

  if (!validateWhatsappPhoneForEnvironment(normalizedPhone)) {
    return {
      status: "skipped",
      purchaseId,
      sentVoucherIds: [],
      skippedReason: "phone_not_allowed_for_testing",
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

  const selectedVoucherIds = Array.from(
    new Set(
      voucherIds.filter(
        (voucherId) => Number.isInteger(voucherId) && voucherId > 0,
      ),
    ),
  );
  const vouchers = await loadSelectedTicketVouchers(purchaseId, selectedVoucherIds);

  if (vouchers.length === 0) {
    return {
      status: "skipped",
      purchaseId,
      sentVoucherIds: [],
      skippedReason: "no_selected_vouchers",
    };
  }

  if (requestId) {
    if (vouchers.length !== selectedVoucherIds.length) return { status: "skipped", purchaseId, sentVoucherIds: [], skippedReason: "voucher_selection_unavailable" };
    const outcome = await operationalTicketRequest("/tickets/resend", {
      requestId, orderId: String(purchaseId), phoneNumber: normalizedPhone, vouchers: buildTicketPayload(purchase, vouchers),
    });
    if (completeStatus(outcome, selectedVoucherIds) !== "accepted") throw new Error("ticket_resend_uncertain");
    return { status: "sent", purchaseId, sentVoucherIds: selectedVoucherIds, upstreamStatus: 200 };
  }

  let response: Awaited<ReturnType<typeof websiteTicketRequest>>;

  try {
    response = await websiteTicketRequest(
      "/website/tickets/send",
      {
        phoneNumber: normalizedPhone,
        vouchers: buildTicketPayload(purchase, vouchers),
      },
    );
  } catch (error) {
    if (isWebsiteTicketApiTesting() && isRetryableTicketServiceError(error)) {
      return {
        status: "skipped",
        purchaseId,
        sentVoucherIds: [],
        skippedReason: "ticket_service_unreachable",
      };
    }

    throw error;
  }

  return {
    status: "sent",
    purchaseId,
    sentVoucherIds: vouchers.map((voucher) => voucher.idvoucher),
    ...(response.status === 202
      ? {
          deliveryStatus: "queued" as const,
          upstreamStatus: response.status,
        }
      : {}),
  };
}

async function operationalTicketRequest(path: string, body: Record<string, unknown>) {
  const config = getConfig();
  if (!config) throw new Error("ticket_service_not_configured");
  const token = await authenticate(config);
  if (!token) throw new Error("ticket_auth_failed");
  return ticketRequest(config,path,{ ...body,useTestDb: config.testing },token,[200,207]);
}
function completeStatus(value: unknown, voucherIds: number[]): "accepted" | "failed" | null {
  if (!value || typeof value !== "object") return null;
  const data = value as {ok?: unknown;vouchers?: unknown};
  if (data.ok !== true || !Array.isArray(data.vouchers) || data.vouchers.length !== voucherIds.length) return null;
  const rows = data.vouchers as {voucherId?: unknown;status?: unknown}[];
  if (rows.some(row => !row || !/^[1-9]\d*$/.test(String(row.voucherId))) ||
    new Set(rows.map(row=>Number(row.voucherId))).size !== voucherIds.length ||
    rows.some(row=>!voucherIds.includes(Number(row.voucherId)))) return null;
  if (rows.every(row=>row.status === "accepted")) return "accepted";
  if (rows.every(row=>row.status === "failed")) return "failed";
  return null;
}
export async function readOperationalTicketWhatsappStatus(requestId: string, purchaseId: number, voucherIds: number[]) {
  return completeStatus(await operationalTicketRequest("/tickets/resend/status",{ requestId,orderId: String(purchaseId),voucherIds }),voucherIds);
}
