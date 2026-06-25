import {
  asOpsClientEducationError,
  autocompleteClients,
} from "@/lib/ops-client-education";
import { runAuthorizedOpsRoute, runOpsRoute } from "@/lib/ops-route-utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return runAuthorizedOpsRoute(
    request,
    {
      requiredPermission: "ops.admin",
      painelPermissions: ["vis_clientes", "vis_escola"],
    },
    () => {
      const url = new URL(request.url);

      return runOpsRoute(
        () =>
          autocompleteClients(
            url.searchParams.get("q"),
            url.searchParams.get("limit"),
          ),
        {
          mapError: asOpsClientEducationError,
          logTag: "ops-admin-clients-autocomplete-bff-failed",
        },
      );
    },
  );
}
