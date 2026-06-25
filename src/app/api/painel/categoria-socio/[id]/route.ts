import {
  asPainelCategoriaSocioError,
  updatePainelCategoriaSocio,
} from "@/lib/painel-categoria-socio";
import { readJsonPayload } from "@/lib/ops-route-utils";
import { runPainelCategoriaSocioRoute } from "@/lib/painel-categoria-socio-route";

export const runtime = "nodejs";

type CategoriaSocioPayload = {
  nmcategoria?: unknown;
  idtabpreco?: unknown;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return runPainelCategoriaSocioRoute(request, context, {
    readPayload: (incomingRequest) =>
      readJsonPayload<CategoriaSocioPayload>(incomingRequest),
    run: ({ params, payload }) =>
      updatePainelCategoriaSocio(params.id, {
        nmcategoria:
          typeof payload?.nmcategoria === "string" ? payload.nmcategoria : "",
        idtabpreco:
          typeof payload?.idtabpreco === "string"
            ? payload.idtabpreco
            : String(payload?.idtabpreco ?? ""),
      }),
    mapError: asPainelCategoriaSocioError,
    logTag: "painel-categoria-socio-update-bff-failed",
  });
}
