import {
  applyAgreementMembersImport,
  asOpsAgreementMemberError,
} from "@/lib/ops-agreement-members";
import { handleAgreementMembersImportRoute } from "@/lib/ops-agreement-members-import-route";
import {
  authorizeOpsRouteAccess,
  readRouteParams,
} from "@/lib/ops-route-utils";

export const runtime = "nodejs";

async function readAgreementId(context: {
  params: Promise<{ agreementId: string }>;
}) {
  const { agreementId } = await readRouteParams(context);
  return agreementId;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ agreementId: string }> },
) {
  const access = await authorizeOpsRouteAccess(request, {
    requiredPermission: "ops.admin",
    painelPermissions: ["vis_conve", "vis_compra"],
  });

  if (!access.ok) {
    return access.response;
  }

  return handleAgreementMembersImportRoute({
    request,
    agreementId: await readAgreementId(context),
    runImport: applyAgreementMembersImport,
    asError: asOpsAgreementMemberError,
    logKey: "ops-agreement-members-import-apply-bff-failed",
  });
}
