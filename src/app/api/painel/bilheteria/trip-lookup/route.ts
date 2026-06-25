import { authorizePainelBilheteriaOpsRoute } from "@/lib/painel-bilheteria-route";
import { opsErrorResponse, opsOkResponse, readJsonPayload } from "@/lib/ops-route-utils";
import {
  lookupPainelBilheteriaTrip,
  PainelBilheteriaWorkstationError,
} from "@/lib/painel-bilheteria-workstation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await authorizePainelBilheteriaOpsRoute(request);

  if (!access.ok) {
    return access.response;
  }

  const payload = await readJsonPayload<{ code?: unknown }>(request);

  try {
    const data = await lookupPainelBilheteriaTrip(
      typeof payload?.code === "string" ? payload.code : "",
    );

    return opsOkResponse(data);
  } catch (error) {
    const normalized =
      error instanceof PainelBilheteriaWorkstationError
        ? error
        : new PainelBilheteriaWorkstationError(
            "trip_lookup_failed",
            "Não foi possível consultar este passeio agora.",
            500,
          );

    return opsErrorResponse(
      normalized.code,
      normalized.message,
      normalized.status,
    );
  }
}
