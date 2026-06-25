import {
  asPainelBilheteriaError,
  sendPainelBilheteriaVoucherWhatsapp,
} from "@/lib/painel-bilheteria";
import {
  readJsonPayload,
} from "@/lib/ops-route-utils";
import { runPainelBilheteriaRoute } from "@/lib/painel-bilheteria-route";

export const runtime = "nodejs";

type SendVoucherWhatsappPayload = {
  purchaseId?: unknown;
  phoneNumber?: unknown;
  actor?: {
    name?: unknown;
    cpf?: unknown;
  } | null;
};

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      voucherId: string;
    }>;
  },
) {
  return runPainelBilheteriaRoute(request, context, {
    readPayload: (currentRequest) =>
      readJsonPayload<SendVoucherWhatsappPayload>(currentRequest),
    run: async ({ params, payload, actor }) =>
      sendPainelBilheteriaVoucherWhatsapp({
        purchaseId: Number(payload?.purchaseId),
        voucherId: Number(params.voucherId),
        phoneNumber: String(payload?.phoneNumber ?? "").trim(),
        actor,
      }),
    mapError: asPainelBilheteriaError,
    logTag: "painel-bilheteria-voucher-whatsapp-failed",
  });
}
