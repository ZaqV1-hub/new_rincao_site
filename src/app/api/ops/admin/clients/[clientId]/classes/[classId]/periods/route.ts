import {
  asOpsClientEducationError,
  createClientPeriod,
  deleteClientPeriod,
  updateClientPeriod,
} from "@/lib/ops-client-education";
import {
  readIdentifier,
  readJsonPayload,
  readRecord,
  readRouteActor,
  readRouteParams,
  readStringOrEmpty,
  runAuthorizedOpsRoute,
  runOpsRoute,
} from "@/lib/ops-route-utils";

export const runtime = "nodejs";

const accessOptions = {
  requiredPermission: "ops.admin" as const,
  painelPermissions: ["vis_clientes", "vis_escola"] as const,
};

type ClientPeriodPayload = {
  id?: unknown;
  reason?: unknown;
  values?: Record<string, unknown> | null;
  actor?: {
    name?: unknown;
    cpf?: unknown;
  } | null;
};

type ClientPeriodRouteContext = {
  params: Promise<{ clientId: string; classId: string }>;
};

async function readParams(context: ClientPeriodRouteContext) {
  return readRouteParams(context);
}

function inputFromPayload(
  params: { clientId: string; classId: string },
  payload: ClientPeriodPayload | null,
) {
  return {
    clientId: params.clientId,
    classId: params.classId,
    id: readIdentifier(payload?.id),
    reason: readStringOrEmpty(payload?.reason),
    values: readRecord(payload?.values),
    actor: readRouteActor(payload?.actor),
  };
}

function createMutationHandler(
  action: (input: ReturnType<typeof inputFromPayload>) => Promise<unknown>,
  logTag: string,
) {
  return async function mutationHandler(
    request: Request,
    context: ClientPeriodRouteContext,
  ) {
    return runAuthorizedOpsRoute(request, accessOptions, async () => {
      const payload = await readJsonPayload<ClientPeriodPayload>(request);
      const params = await readParams(context);

      return runOpsRoute(() => action(inputFromPayload(params, payload)), {
        mapError: asOpsClientEducationError,
        logTag,
      });
    });
  };
}

export const POST = createMutationHandler(
  createClientPeriod,
  "ops-admin-client-period-create-bff-failed",
);

export const PATCH = createMutationHandler(
  updateClientPeriod,
  "ops-admin-client-period-update-bff-failed",
);

export const DELETE = createMutationHandler(
  deleteClientPeriod,
  "ops-admin-client-period-delete-bff-failed",
);
