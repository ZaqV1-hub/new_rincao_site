import {
  asOpsAdminParametersError,
  listOpsAdminParameters,
  updateOpsAdminParameters,
} from "@/lib/ops-admin-parameters";
import {
  authorizeOpsRouteAccess,
  readJsonPayload,
  readRouteActor,
  readStringOrEmpty,
  runOpsRoute,
} from "@/lib/ops-route-utils";

export const runtime = "nodejs";

type ParametersPayload = {
  reason?: unknown;
  parameters?: unknown;
  actor?: {
    name?: unknown;
    cpf?: unknown;
  } | null;
};

export async function GET(request: Request) {
  const access = await authorizeOpsRouteAccess(request, {
    requiredPermission: "ops.admin",
    painelPermissions: "vis_param",
  });

  if (!access.ok) {
    return access.response;
  }

  return runOpsRoute(() => listOpsAdminParameters(), {
    mapError: asOpsAdminParametersError,
    logTag: "ops-admin-parameters-list-bff-failed",
  });
}

export async function PATCH(request: Request) {
  const access = await authorizeOpsRouteAccess(request, {
    requiredPermission: "ops.admin",
    painelPermissions: "vis_param",
  });

  if (!access.ok) {
    return access.response;
  }

  const payload = await readJsonPayload<ParametersPayload>(request);

  return runOpsRoute(
    () =>
      updateOpsAdminParameters({
        reason: readStringOrEmpty(payload?.reason),
        parameters: Array.isArray(payload?.parameters)
          ? (payload.parameters as Array<{
              group?: string | null;
              id?: string | null;
              value?: string | null;
            }>)
          : [],
        actor: readRouteActor(payload?.actor),
      }),
    {
      mapError: asOpsAdminParametersError,
      logTag: "ops-admin-parameters-update-bff-failed",
    },
  );
}
