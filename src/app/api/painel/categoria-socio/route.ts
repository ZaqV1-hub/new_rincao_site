import {
  asPainelCategoriaSocioError,
  createPainelCategoriaSocio,
} from "@/lib/painel-categoria-socio";
import { readJsonPayload } from "@/lib/ops-route-utils";
import { runPainelCategoriaSocioRoute } from "@/lib/painel-categoria-socio-route";

export const runtime = "nodejs";

type CategoriaSocioPayload = {
  nmcategoria?: unknown;
  idtabpreco?: unknown;
};

export async function POST(request: Request) {
  return runPainelCategoriaSocioRoute(request, { params: Promise.resolve({}) }, {
    readPayload: (incomingRequest) =>
      readJsonPayload<CategoriaSocioPayload>(incomingRequest),
    run: ({ payload }) =>
      createPainelCategoriaSocio({
        nmcategoria:
          typeof payload?.nmcategoria === "string" ? payload.nmcategoria : "",
        idtabpreco:
          typeof payload?.idtabpreco === "string"
            ? payload.idtabpreco
            : String(payload?.idtabpreco ?? ""),
      }),
    mapError: asPainelCategoriaSocioError,
    logTag: "painel-categoria-socio-create-bff-failed",
  });
}
