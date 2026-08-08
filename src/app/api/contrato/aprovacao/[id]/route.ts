import {
  asSchoolContractError,
  confirmSchoolContract,
  getRequestIpAddress,
} from "@/lib/school-contracts";
import { readJsonPayload, runOpsRoute } from "@/lib/ops-route-utils";

export const runtime = "nodejs";

type ApprovalPayload = {
  representativeLogin?: unknown;
  representativePassword?: unknown;
};

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
        representativeLogin: payload?.representativeLogin,
        representativePassword: payload?.representativePassword,
        ipAddress,
      }),
    {
      mapError: asSchoolContractError,
      logTag: "school-contract-confirm-failed",
    },
  );
}
