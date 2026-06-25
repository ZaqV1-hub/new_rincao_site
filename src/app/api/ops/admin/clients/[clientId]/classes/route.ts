import {
  asOpsClientEducationError,
  createClientClass,
  deleteClientClass,
  getClientEducationSummary,
  updateClientClass,
} from "@/lib/ops-client-education";
import {
  readIdentifier,
  readJsonPayload,
  readRecord,
  readRouteActor,
  readStringOrEmpty,
  runAuthorizedOpsRoute,
  runOpsRoute,
} from "@/lib/ops-route-utils";

export const runtime = "nodejs";

const accessOptions = {
  requiredPermission: "ops.admin" as const,
  painelPermissions: ["vis_clientes", "vis_escola"] as const,
};

type ClientClassPayload = {
  id?: unknown;
  reason?: unknown;
  values?: Record<string, unknown> | null;
  actor?: {
    name?: unknown;
    cpf?: unknown;
  } | null;
};

type ClientClassRouteContext = {
  params: Promise<{ clientId: string }>;
};

async function readClientId(context: ClientClassRouteContext) {
  const { clientId } = await context.params;
  return clientId;
}

function inputFromPayload(clientId: string, payload: ClientClassPayload | null) {
  return {
    clientId,
    id: readIdentifier(payload?.id),
    reason: readStringOrEmpty(payload?.reason),
    values: readRecord(payload?.values),
    actor: readRouteActor(payload?.actor),
  };
}

export async function GET(
  request: Request,
  context: ClientClassRouteContext,
) {
  return runAuthorizedOpsRoute(request, accessOptions, () =>
    runOpsRoute(async () => getClientEducationSummary(await readClientId(context)), {
      mapError: asOpsClientEducationError,
      logTag: "ops-admin-client-classes-list-bff-failed",
    }),
  );
}

function createMutationHandler(
  action: (input: ReturnType<typeof inputFromPayload>) => Promise<unknown>,
  logTag: string,
) {
  return async function mutationHandler(
    request: Request,
    context: ClientClassRouteContext,
  ) {
    return runAuthorizedOpsRoute(request, accessOptions, async () => {
      const payload = await readJsonPayload<ClientClassPayload>(request);
      const clientId = await readClientId(context);

      return runOpsRoute(() => action(inputFromPayload(clientId, payload)), {
        mapError: asOpsClientEducationError,
        logTag,
      });
    });
  };
}

export const POST = createMutationHandler(
  createClientClass,
  "ops-admin-client-class-create-bff-failed",
);

export const PATCH = createMutationHandler(
  updateClientClass,
  "ops-admin-client-class-update-bff-failed",
);

export const DELETE = createMutationHandler(
  deleteClientClass,
  "ops-admin-client-class-delete-bff-failed",
);
