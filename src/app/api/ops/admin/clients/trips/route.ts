import {
  asOpsClientTripError,
  createOpsClientTrip,
  listOpsClientTrips,
} from "@/lib/ops-client-trips";
import {
  readJsonPayload,
  readRouteActor,
  runAuthorizedOpsRoute,
  runOpsRoute,
} from "@/lib/ops-route-utils";

export const runtime = "nodejs";

const accessOptions = {
  requiredPermission: "ops.read" as const,
  painelPermissions: ["vis_clientes", "vis_escola"] as const,
};

type ClientTripPayload = {
  agendaId?: unknown;
  clientId?: unknown;
  acceptsFamily?: unknown;
  faixas?: unknown;
  actor?: {
    name?: unknown;
    cpf?: unknown;
  } | null;
};

export async function GET(request: Request) {
  return runAuthorizedOpsRoute(request, accessOptions, () => {
    const url = new URL(request.url);

    return runOpsRoute(() => listOpsClientTrips({
      code: url.searchParams.get("code"),
      query: url.searchParams.get("query"),
      typeId: url.searchParams.get("typeId"),
      status: url.searchParams.get("status"),
      fromDate: url.searchParams.get("fromDate"),
      toDate: url.searchParams.get("toDate"),
      page: url.searchParams.get("page"),
      pageSize: url.searchParams.get("pageSize"),
    }), {
      mapError: asOpsClientTripError,
      logTag: "ops-admin-client-trips-list-bff-failed",
    });
  });
}

export async function POST(request: Request) {
  return runAuthorizedOpsRoute(request, accessOptions, async () => {
    const payload = await readJsonPayload<ClientTripPayload>(request);

    return runOpsRoute(() => createOpsClientTrip({
      agendaId: payload?.agendaId,
      clientId: payload?.clientId,
      acceptsFamily: payload?.acceptsFamily,
      faixas: payload?.faixas,
      actor: readRouteActor(payload?.actor),
    }), {
      mapError: asOpsClientTripError,
      logTag: "ops-admin-client-trips-create-bff-failed",
    });
  });
}
