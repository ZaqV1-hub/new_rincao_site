import {
  asOpsClientEducationError,
  listClientTypes,
} from "@/lib/ops-client-education";
import { authorizeOpsRouteAccess, runOpsRoute } from "@/lib/ops-route-utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await authorizeOpsRouteAccess(request, {
    requiredPermission: "ops.admin",
    painelPermissions: ["vis_clientes", "vis_escola"],
  });

  if (!access.ok) {
    return access.response;
  }

  return runOpsRoute(() => listClientTypes(), {
    mapError: asOpsClientEducationError,
    logTag: "ops-admin-client-types-list-bff-failed",
  });
}
