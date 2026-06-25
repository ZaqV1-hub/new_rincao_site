import {
  asOpsAdminMasterDataError,
  createOpsAdminMasterData,
  deleteOpsAdminMasterData,
  listOpsAdminMasterData,
  updateOpsAdminMasterData,
} from "@/lib/ops-admin-master-data";
import {
  getLegacyResourcesForMasterDataResource,
} from "@/lib/painel-api-auth";
import {
  authorizeOpsRouteAccess,
  readIdentifier,
  readJsonPayload,
  readRecord,
  readRouteActor,
  readRouteParams,
  readStringOrEmpty,
  runOpsRoute,
} from "@/lib/ops-route-utils";

export const runtime = "nodejs";

type MasterDataPayload = {
  id?: unknown;
  reason?: unknown;
  values?: Record<string, unknown> | null;
  actor?: {
    name?: unknown;
    cpf?: unknown;
  } | null;
};

function inputFromPayload(payload: MasterDataPayload | null) {
  return {
    id: readIdentifier(payload?.id),
    reason: readStringOrEmpty(payload?.reason),
    values: readRecord(payload?.values),
    actor: readRouteActor(payload?.actor),
  };
}

async function readResource(context: {
  params: Promise<{ resource: string }>;
}) {
  const { resource } = await readRouteParams(context);

  return resource;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ resource: string }> },
) {
  const resource = await readResource(context);
  const access = await authorizeOpsRouteAccess(request, {
    requiredPermission: "ops.admin",
    painelPermissions: getLegacyResourcesForMasterDataResource(resource),
  });

  if (!access.ok) {
    return access.response;
  }

  return runOpsRoute(() => listOpsAdminMasterData(resource), {
    mapError: asOpsAdminMasterDataError,
    logTag: "ops-admin-master-data-list-bff-failed",
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ resource: string }> },
) {
  const resource = await readResource(context);
  const access = await authorizeOpsRouteAccess(request, {
    requiredPermission: "ops.admin",
    painelPermissions: getLegacyResourcesForMasterDataResource(resource),
  });

  if (!access.ok) {
    return access.response;
  }

  const payload = await readJsonPayload<MasterDataPayload>(request);

  return runOpsRoute(
    () => createOpsAdminMasterData(resource, inputFromPayload(payload)),
    {
      mapError: asOpsAdminMasterDataError,
      logTag: "ops-admin-master-data-create-bff-failed",
    },
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ resource: string }> },
) {
  const resource = await readResource(context);
  const access = await authorizeOpsRouteAccess(request, {
    requiredPermission: "ops.admin",
    painelPermissions: getLegacyResourcesForMasterDataResource(resource),
  });

  if (!access.ok) {
    return access.response;
  }

  const payload = await readJsonPayload<MasterDataPayload>(request);

  return runOpsRoute(
    () => updateOpsAdminMasterData(resource, inputFromPayload(payload)),
    {
      mapError: asOpsAdminMasterDataError,
      logTag: "ops-admin-master-data-update-bff-failed",
    },
  );
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ resource: string }> },
) {
  const resource = await readResource(context);
  const access = await authorizeOpsRouteAccess(request, {
    requiredPermission: "ops.admin",
    painelPermissions: getLegacyResourcesForMasterDataResource(resource),
  });

  if (!access.ok) {
    return access.response;
  }

  const payload = await readJsonPayload<MasterDataPayload>(request);

  return runOpsRoute(
    () => deleteOpsAdminMasterData(resource, inputFromPayload(payload)),
    {
      mapError: asOpsAdminMasterDataError,
      logTag: "ops-admin-master-data-delete-bff-failed",
    },
  );
}
