import {
  readJsonPayload,
} from "@/lib/ops-route-utils";
import { runPainelBilheteriaRoute } from "@/lib/painel-bilheteria-route";
import { sendPurchaseTicketsWhatsApp } from "@/lib/ticket-service";

export const runtime = "nodejs";

type SendPurchaseWhatsappPayload = {
  phoneNumber?: unknown;
  voucherIds?: unknown;
};

function resolveSkippedWhatsappMessage(skippedReason?: string) {
  switch (skippedReason) {
    case "ticket_service_not_configured":
      return "Servico de envio por WhatsApp nao configurado neste ambiente.";
    case "ticket_auth_failed":
      return "Nao foi possivel autenticar o servico de envio por WhatsApp.";
    case "phone_not_allowed_for_testing":
      return "Numero nao autorizado para este ambiente.";
    case "invalid_phone_number":
      return "Informe telefone com DDD para enviar os ingressos.";
    case "no_selected_vouchers":
      return "Nenhum voucher elegivel foi selecionado para envio por WhatsApp.";
    case "purchase_not_confirmed":
      return "A compra ainda nao esta confirmada para envio por WhatsApp.";
    default:
      return "Nao foi possivel enviar os ingressos selecionados por WhatsApp.";
  }
}

function asWhatsappRouteError(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    "message" in error &&
    "status" in error
  ) {
    return error as {
      code: string;
      message: string;
      status: number;
    };
  }

  if (error instanceof Error) {
    return {
      code: "painel_bilheteria_whatsapp_failed",
      message: error.message || "Nao foi possivel enviar os ingressos por WhatsApp.",
      status: 502,
    };
  }

  return {
    code: "painel_bilheteria_whatsapp_failed",
    message: "Nao foi possivel enviar os ingressos por WhatsApp.",
    status: 502,
  };
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      purchaseId: string;
    }>;
  },
) {
  return runPainelBilheteriaRoute(request, context, {
    readPayload: (currentRequest) =>
      readJsonPayload<SendPurchaseWhatsappPayload>(currentRequest),
    run: async ({ params, payload }) => {
      const purchaseId = Number(params.purchaseId);
      const phoneNumber = String(payload?.phoneNumber ?? "").trim();
      const voucherIds = Array.isArray(payload?.voucherIds)
        ? payload.voucherIds
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value > 0)
        : [];
      const result = await sendPurchaseTicketsWhatsApp(
        purchaseId,
        voucherIds,
        phoneNumber,
      );

      if (result.status !== "sent") {
        throw {
          code: result.skippedReason ?? "whatsapp_unavailable",
          message: resolveSkippedWhatsappMessage(result.skippedReason),
          status: 409,
        };
      }

      return {
        purchaseId: result.purchaseId,
        sentVoucherIds: result.sentVoucherIds,
        message: "Ingressos enviados por WhatsApp com sucesso.",
      };
    },
    mapError: asWhatsappRouteError,
    logTag: "painel-bilheteria-purchase-whatsapp-failed",
  });
}
