import {
  asSchoolContractError,
  confirmSchoolContract,
  getRequestIpAddress,
} from "@/lib/school-contracts";
import { readJsonPayload, runOpsRoute } from "@/lib/ops-route-utils";

export const runtime = "nodejs";

type ApprovalPayload = {
  confirmerName?: unknown;
  confirmerRole?: unknown;
};

function getBaseUrlFromRequest(request: Request) {
  const configuredBaseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.SITE_BASE_URL?.trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, "");
  }

  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return url.origin;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const [{ id }, payload, ipAddress] = await Promise.all([
    context.params,
    readJsonPayload<ApprovalPayload>(request),
    getRequestIpAddress(),
  ]);

  return runOpsRoute(
    () =>
      confirmSchoolContract({
        token: id,
        confirmerName: payload?.confirmerName,
        confirmerRole: payload?.confirmerRole,
        ipAddress,
        baseUrl: getBaseUrlFromRequest(request),
      }),
    {
      mapError: asSchoolContractError,
      logTag: "school-contract-confirm-failed",
    },
  );
}
