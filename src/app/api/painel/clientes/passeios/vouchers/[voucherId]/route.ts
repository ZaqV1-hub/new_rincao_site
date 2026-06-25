import {
  asPainelClientesError,
  updatePainelTripVoucherStudent,
} from "@/lib/painel-clientes";
import { runPainelClientesRoute } from "@/lib/painel-clientes-route";
import { readJsonPayload } from "@/lib/ops-route-utils";

export const runtime = "nodejs";

type VoucherPayload = {
  purchaseId?: unknown;
  studentName?: unknown;
  educationType?: unknown;
  educationYear?: unknown;
  classLetter?: unknown;
  schoolId?: unknown;
  agendaId?: unknown;
  value?: unknown;
  purchaseStatus?: unknown;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ voucherId: string }> },
) {
  return runPainelClientesRoute(request, context, {
    readPayload: (incomingRequest) => readJsonPayload<VoucherPayload>(incomingRequest),
    run: ({ params, payload, actor }) =>
      updatePainelTripVoucherStudent({
        voucherId: params.voucherId,
        actor,
        values: payload,
      }),
    mapError: asPainelClientesError,
    logTag: "painel-clientes-trip-voucher-bff-failed",
  });
}
