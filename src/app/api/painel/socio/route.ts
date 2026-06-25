import { asPainelSociosError, createPainelSocio } from "@/lib/painel-socios";
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
};

export async function POST(request: Request) {
  return runPainelSociosRoute(request, { params: Promise.resolve({}) }, {
    readPayload: (incomingRequest) => readJsonPayload<SocioPayload>(incomingRequest),
    run: ({ payload }) =>
      createPainelSocio({
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
      }),
    mapError: asPainelSociosError,
    logTag: "painel-socio-create-bff-failed",
  });
}
