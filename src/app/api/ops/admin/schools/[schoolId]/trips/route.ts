import {
  asOpsSchoolTripsError,
  createOpsSchoolTripDate,
  getOpsSchoolTripsScreenData,
} from "@/lib/ops-school-trips";
import {
  readJsonPayload,
  readRouteActor,
  readStringOrEmpty,
  runAuthorizedOpsRoute,
  runOpsRoute,
} from "@/lib/ops-route-utils";

export const runtime = "nodejs";

const accessOptions = {
  requiredPermission: "ops.admin" as const,
  painelPermissions: ["vis_escola"] as const,
};

type SchoolTripPayload = {
  visitDate?: unknown;
  actor?: {
    name?: unknown;
    cpf?: unknown;
  } | null;
};

async function readSchoolId(context: {
  params: Promise<{ schoolId: string }>;
}) {
  const { schoolId } = await context.params;
  return schoolId;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ schoolId: string }> },
) {
  return runAuthorizedOpsRoute(request, accessOptions, () =>
    runOpsRoute(
      async () =>
        getOpsSchoolTripsScreenData({
          schoolId: await readSchoolId(context),
        }),
      { mapError: asOpsSchoolTripsError },
    ),
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ schoolId: string }> },
) {
  return runAuthorizedOpsRoute(request, accessOptions, async () => {
    const payload = await readJsonPayload<SchoolTripPayload>(request);

    return runOpsRoute(
      async () =>
        createOpsSchoolTripDate({
          schoolId: await readSchoolId(context),
          visitDate: readStringOrEmpty(payload?.visitDate),
          actor: readRouteActor(payload?.actor),
        }),
      { mapError: asOpsSchoolTripsError },
    );
  });
}
