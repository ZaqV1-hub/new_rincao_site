import { loadConfirmedPurchase } from "@/lib/ticket-purchase-eligibility";
import { TicketWhatsappSendResult } from "@/lib/ticket-service-contract";
import { isRetryableTicketServiceError, digitsOnly, validateWhatsappPhoneForEnvironment, isWebsiteTicketApiTesting } from "@/lib/ticket-service-config";
import { websiteTicketRequest } from "@/lib/ticket-service-transport";
import { loadSelectedTicketVouchers } from "@/lib/ticket-service-queries";
import { buildTicketPayload } from "@/lib/ticket-service-payload";

export async function sendPurchaseTicketsWhatsApp(
  purchaseId: number,
  voucherIds: number[],
  phoneNumber: string,
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

