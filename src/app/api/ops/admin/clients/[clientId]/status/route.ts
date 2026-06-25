import {
  asOpsClientEducationError,
  toggleClientStatus,
} from "@/lib/ops-client-education";
import {
  readJsonPayload,
  readRouteActor,
  readStringOrEmpty,
  runAuthorizedOpsRoute,
  runOpsRoute,
} from "@/lib/ops-route-utils";

export const runtime = "nodejs";

type ClientStatusPayload = {
  reason?: unknown;
  actor?: {
    name?: unknown;
    cpf?: unknown;
  } | null;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  return runAuthorizedOpsRoute(
    request,
    {
      requiredPermission: "ops.admin",
      painelPermissions: ["vis_clientes", "vis_escola"],
    },
    async () => {
      const payload = await readJsonPayload<ClientStatusPayload>(request);
      const { clientId } = await context.params;

      return runOpsRoute(
        () =>
          toggleClientStatus({
            clientId,
            reason: readStringOrEmpty(payload?.reason),
            actor: readRouteActor(payload?.actor),
          }),
        {
          mapError: asOpsClientEducationError,
          logTag: "ops-admin-client-status-toggle-bff-failed",
        },
      );
    },
  );
}
