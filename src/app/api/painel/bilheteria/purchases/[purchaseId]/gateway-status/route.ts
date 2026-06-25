import {
  asPainelBilheteriaError,
  getPainelBilheteriaGatewayStatus,
} from "@/lib/painel-bilheteria";
import { runPainelBilheteriaRoute } from "@/lib/painel-bilheteria-route";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      purchaseId: string;
    }>;
  },
) {
  return runPainelBilheteriaRoute(request, context, {
    run: async ({ params }) =>
      getPainelBilheteriaGatewayStatus(Number(params.purchaseId)),
    mapError: asPainelBilheteriaError,
    logTag: "painel-bilheteria-gateway-status-failed",
  });
}
