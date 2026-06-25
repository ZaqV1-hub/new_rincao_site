import {
  asPainelBilheteriaError,
  payPainelBilheteriaReservation,
} from "@/lib/painel-bilheteria";
import {
  readJsonPayload,
} from "@/lib/ops-route-utils";
import { runPainelBilheteriaRoute } from "@/lib/painel-bilheteria-route";

export const runtime = "nodejs";

type PayReservationPayload = {
  payments?: unknown;
  actor?: {
    name?: unknown;
    cpf?: unknown;
  } | null;
};

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
      readJsonPayload<PayReservationPayload>(currentRequest),
    run: async ({ params, payload, actor }) =>
      payPainelBilheteriaReservation({
        purchaseId: Number(params.purchaseId),
        payments: Array.isArray(payload?.payments)
          ? (payload.payments as Array<{
              method: string;
              value: string | number;
            }>)
          : [],
        actor,
      }),
    mapError: asPainelBilheteriaError,
    logTag: "painel-bilheteria-reservation-pay-failed",
  });
}
