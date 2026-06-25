import {
  asOpsSchoolTripsError,
  deleteOpsSchoolTripDate,
  updateOpsSchoolTripDateStatus,
} from "@/lib/ops-school-trips";
import {
  readJsonPayload,
  readRouteActor,
  readRouteParams,
  readStringOrEmpty,
  runAuthorizedOpsRoute,
  runOpsRoute,
} from "@/lib/ops-route-utils";

export const runtime = "nodejs";

const accessOptions = {
  requiredPermission: "ops.admin" as const,
  painelPermissions: ["vis_escola"] as const,
};

type SchoolTripMutationPayload = {
  status?: unknown;
  reason?: unknown;
  actor?: {
    name?: unknown;
    cpf?: unknown;
  } | null;
};

type SchoolTripRouteContext = {
  params: Promise<{ schoolId: string; agendaId: string }>;
};

async function readParams(context: SchoolTripRouteContext) {
  return readRouteParams(context);
}

function createMutationHandler(
  action: (
    input: Awaited<ReturnType<typeof readParams>>,
    payload: SchoolTripMutationPayload | null,
  ) => Promise<unknown>,
) {
  return async function mutationHandler(
    request: Request,
    context: SchoolTripRouteContext,
  ) {
    return runAuthorizedOpsRoute(request, accessOptions, async () => {
      const payload = await readJsonPayload<SchoolTripMutationPayload>(request);
      const params = await readParams(context);

      return runOpsRoute(() => action(params, payload), {
        mapError: asOpsSchoolTripsError,
      });
    });
  };
}

export const PATCH = createMutationHandler((params, payload) =>
  updateOpsSchoolTripDateStatus({
    schoolId: params.schoolId,
    agendaId: params.agendaId,
    status: readStringOrEmpty(payload?.status),
    actor: readRouteActor(payload?.actor),
  }),
);

export const DELETE = createMutationHandler((params, payload) =>
  deleteOpsSchoolTripDate({
    schoolId: params.schoolId,
    agendaId: params.agendaId,
    reason: readStringOrEmpty(payload?.reason),
    actor: readRouteActor(payload?.actor),
  }),
);
