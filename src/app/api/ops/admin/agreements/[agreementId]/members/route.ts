import {
  asOpsAgreementMemberError,
  createAgreementMember,
  deleteAgreementMember,
  listAgreementMembers,
  updateAgreementMember,
} from "@/lib/ops-agreement-members";
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
  painelPermissions: ["vis_conve", "vis_compra"] as const,
};

type AgreementMemberPayload = {
  id?: unknown;
  reason?: unknown;
  values?: Record<string, unknown> | null;
  actor?: {
    name?: unknown;
    cpf?: unknown;
  } | null;
};

type AgreementMemberRouteContext = {
  params: Promise<{ agreementId: string }>;
};

async function readAgreementId(context: AgreementMemberRouteContext) {
  const { agreementId } = await readRouteParams(context);
  return agreementId;
}

function inputFromPayload(agreementId: string, payload: AgreementMemberPayload | null) {
  return {
    agreementId,
    id: readIdentifier(payload?.id),
    reason: readStringOrEmpty(payload?.reason),
    values: readRecord(payload?.values),
    actor: readRouteActor(payload?.actor),
  };
}

export async function GET(
  request: Request,
  context: AgreementMemberRouteContext,
) {
  return runAuthorizedOpsRoute(request, accessOptions, async () => {
    const agreementId = await readAgreementId(context);
    const url = new URL(request.url);

    return runOpsRoute(() => listAgreementMembers({
      agreementId,
      cpf: url.searchParams.get("cpf"),
      status: url.searchParams.get("status"),
      startDateFrom: url.searchParams.get("startDateFrom"),
      startDateTo: url.searchParams.get("startDateTo"),
      endDateFrom: url.searchParams.get("endDateFrom"),
      endDateTo: url.searchParams.get("endDateTo"),
    }), {
      mapError: asOpsAgreementMemberError,
      logTag: "ops-agreement-members-list-bff-failed",
    });
  });
}

function createMutationHandler(
  action: (input: ReturnType<typeof inputFromPayload>) => Promise<unknown>,
  logTag: string,
) {
  return async function mutationHandler(
    request: Request,
    context: AgreementMemberRouteContext,
  ) {
    return runAuthorizedOpsRoute(request, accessOptions, async () => {
      const agreementId = await readAgreementId(context);
      const payload = await readJsonPayload<AgreementMemberPayload>(request);

      return runOpsRoute(() => action(inputFromPayload(agreementId, payload)), {
        mapError: asOpsAgreementMemberError,
        logTag,
      });
    });
  };
}

export const POST = createMutationHandler(
  createAgreementMember,
  "ops-agreement-members-create-bff-failed",
);

export const PATCH = createMutationHandler(
  updateAgreementMember,
  "ops-agreement-members-update-bff-failed",
);

export const DELETE = createMutationHandler(
  deleteAgreementMember,
  "ops-agreement-members-delete-bff-failed",
);
