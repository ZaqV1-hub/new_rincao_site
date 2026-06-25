import { asPainelSociosError, updatePainelSocio } from "@/lib/painel-socios";
import { readJsonPayload } from "@/lib/ops-route-utils";
import { runPainelSociosRoute } from "@/lib/painel-socios-route";

export const runtime = "nodejs";

type SocioPayload = {
  cpf?: unknown;
  dtinisoc?: unknown;
  dtfimsoc?: unknown;
  nmsocio?: unknown;
  qtcompradia?: unknown;
  idsociocateg?: unknown;
  stsocio?: unknown;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ cpf: string }> },
) {
  return runPainelSociosRoute(request, context, {
    readPayload: (incomingRequest) => readJsonPayload<SocioPayload>(incomingRequest),
    run: ({ params, payload }) =>
      updatePainelSocio(params.cpf, {
        cpf: typeof payload?.cpf === "string" ? payload.cpf : "",
        dtinisoc: typeof payload?.dtinisoc === "string" ? payload.dtinisoc : "",
        dtfimsoc: typeof payload?.dtfimsoc === "string" ? payload.dtfimsoc : "",
        nmsocio: typeof payload?.nmsocio === "string" ? payload.nmsocio : "",
        qtcompradia:
          typeof payload?.qtcompradia === "string"
            ? payload.qtcompradia
            : String(payload?.qtcompradia ?? ""),
        idsociocateg:
          typeof payload?.idsociocateg === "string"
            ? payload.idsociocateg
            : String(payload?.idsociocateg ?? ""),
        stsocio: typeof payload?.stsocio === "string" ? payload.stsocio : "ati",
      }),
    mapError: asPainelSociosError,
    logTag: "painel-socio-update-bff-failed",
  });
}
