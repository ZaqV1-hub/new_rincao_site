import { NextResponse } from "next/server";
import {
  customerApiErrorResponse,
  readCustomerJsonPayload,
} from "@/lib/customer-api-route";
import {
  parseDistinctPositiveIds,
  requireAuthenticatedVoucherRouteId,
} from "@/lib/customer-voucher-route";
import { sendPurchaseTicketsWhatsApp } from "@/lib/ticket-service";
import { getUserVoucherExportData } from "@/lib/voucher-repository";

export const runtime = "nodejs";

type WhatsappRequestBody = {
  voucherIds?: unknown;
  phoneNumber?: unknown;
};

function parseVoucherIds(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  return parseDistinctPositiveIds(value);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ voucherId: string }> },
) {
  const route = await requireAuthenticatedVoucherRouteId(context, {
    invalidCode: "invalid_purchase_id",
    invalidMessage: "Informe um identificador de compra valido.",
  });

  if (!route.ok) {
    return route.response;
  }

  const purchaseId = route.routeId;

  const payload = await readCustomerJsonPayload<WhatsappRequestBody>(request);

  if (!payload) {
    return customerApiErrorResponse(
      "invalid_whatsapp_request",
      "Nao foi possivel preparar o envio por WhatsApp.",
      400,
    );
  }

  const voucherIds = parseVoucherIds(payload?.voucherIds);
  const phoneNumber = String(payload?.phoneNumber ?? "").trim();

  if (!voucherIds || voucherIds.length === 0) {
    return customerApiErrorResponse(
      "invalid_voucher_selection",
      "Informe vouchers validos para envio por WhatsApp.",
      400,
    );
  }

  if (phoneNumber.replace(/\D+/g, "").length < 11) {
    return customerApiErrorResponse(
      "invalid_phone_number",
      "Informe um numero de WhatsApp valido com DDD.",
      400,
    );
  }

  try {
    const user = route.subject;

    const exportData = await getUserVoucherExportData(
      user.cpf,
      purchaseId,
      voucherIds,
    );

    if (!exportData) {
      return customerApiErrorResponse(
        "purchase_not_found",
        "Compra nao encontrada para esta conta.",
        404,
      );
    }

    if (!exportData.purchase.canGenerateVoucher) {
      return customerApiErrorResponse(
        "whatsapp_unavailable",
        "Esta compra nao pode enviar vouchers por WhatsApp agora.",
        409,
      );
    }

    if (exportData.vouchers.length === 0) {
      return customerApiErrorResponse(
        "voucher_selection_empty",
        "Nenhum voucher elegivel foi selecionado para envio por WhatsApp.",
        409,
      );
    }

    const result = await sendPurchaseTicketsWhatsApp(
      purchaseId,
      exportData.vouchers.map((voucher) => voucher.id),
      phoneNumber,
    );

    if (result.status !== "sent") {
      const message =
        result.skippedReason === "phone_not_allowed_for_testing"
          ? "Numero nao autorizado para este ambiente."
          : "Nao foi possivel enviar os vouchers por WhatsApp agora.";

      return customerApiErrorResponse("whatsapp_unavailable", message, 502);
    }

    return NextResponse.json({
      ok: true,
      data: {
        purchaseId,
        voucherIds: result.sentVoucherIds,
        phoneNumber: phoneNumber.replace(/\D+/g, ""),
      },
    });
  } catch (error) {
    console.error("user-voucher-whatsapp-bff-failed", error);

    return customerApiErrorResponse(
      "whatsapp_unavailable",
      "Nao foi possivel enviar os vouchers por WhatsApp agora.",
      502,
    );
  }
}
