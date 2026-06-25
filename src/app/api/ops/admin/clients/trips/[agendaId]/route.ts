import {
  asOpsClientTripError,
  unlinkOpsClientTrip,
  updateOpsClientTrip,
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
  clientId?: unknown;
  acceptsFamily?: unknown;
  faixas?: unknown;
  actor?: {
    name?: unknown;
    cpf?: unknown;
  } | null;
};

type ClientTripRouteContext = {
  params: Promise<{ agendaId: string }>;
};

function readActor(payload: ClientTripPayload | null) {
  return readRouteActor(payload?.actor);
}

async function readAgendaId(context: ClientTripRouteContext) {
  const { agendaId } = await context.params;
  return agendaId;
}

function createMutationHandler(
  action: (
    input: string,
    payload: ClientTripPayload | null,
  ) => Promise<unknown>,
  logTag: string,
) {
  return async function mutationHandler(
    request: Request,
    context: ClientTripRouteContext,
  ) {
    return runAuthorizedOpsRoute(request, accessOptions, async () => {
      const payload = await readJsonPayload<ClientTripPayload>(request);
      const agendaId = await readAgendaId(context);

      return runOpsRoute(() => action(agendaId, payload), {
        mapError: asOpsClientTripError,
        logTag,
      });
    });
  };
}

export const PATCH = createMutationHandler(
  (agendaId, payload) =>
    updateOpsClientTrip({
      agendaId,
      clientId: payload?.clientId,
      acceptsFamily: payload?.acceptsFamily,
      faixas: payload?.faixas,
      actor: readActor(payload),
    }),
  "ops-admin-client-trips-update-bff-failed",
);

export const DELETE = createMutationHandler(
  (agendaId, payload) =>
    unlinkOpsClientTrip({
      agendaId,
      clientId: payload?.clientId,
      actor: readActor(payload),
    }),
  "ops-admin-client-trips-unlink-bff-failed",
);
