import {
  asOpsReferenceDataError,
  createOperationalCourtesyAuthor,
  createOperationalDiscount,
  createOperationalDiscountType,
  deleteOperationalCourtesyAuthor,
  deleteOperationalDiscount,
  deleteOperationalDiscountType,
  getOperationalReferenceData,
  updateOperationalCourtesyAuthor,
  updateOperationalDiscount,
  updateOperationalDiscountType,
} from "@/lib/ops-reference-data";
import {
  authorizeOpsRouteAccess,
  opsErrorResponse,
  readJsonPayload,
  readRouteActor,
  readStringOrEmpty,
  runAuthorizedOpsRoute,
  runOpsRoute,
} from "@/lib/ops-route-utils";

export const runtime = "nodejs";

type ReferenceResource = "discount_type" | "discount" | "courtesy_author";

type ReferenceDataPayload = {
  resource?: unknown;
  id?: unknown;
  description?: unknown;
  typeId?: unknown;
  name?: unknown;
  applicationType?: unknown;
  value?: unknown;
  reason?: unknown;
  actor?: {
    name?: unknown;
    cpf?: unknown;
  } | null;
};

type ReferenceMutationInput = {
  id: number;
  description: string;
  typeId: number;
  name: string;
  applicationType: string;
  value: string | number | null | undefined;
  reason: string;
  actor: ReturnType<typeof readRouteActor>;
};

type ReferenceMutationConfig = {
  painelPermission: "vis_desc" | "vis_cort";
  create: (input: ReferenceMutationInput) => Promise<unknown>;
  update: (input: ReferenceMutationInput) => Promise<unknown>;
  remove: (input: ReferenceMutationInput) => Promise<unknown>;
};

const invalidResourceMessage =
  "Informe resource como discount_type, discount ou courtesy_author.";

const resourceConfigs: Record<ReferenceResource, ReferenceMutationConfig> = {
  discount_type: {
    painelPermission: "vis_desc",
    create: async (input) =>
      createOperationalDiscountType({
        description: input.description,
        reason: input.reason,
        actor: input.actor,
      }),
    update: async (input) =>
      updateOperationalDiscountType({
        id: input.id,
        description: input.description,
        reason: input.reason,
        actor: input.actor,
      }),
    remove: async (input) =>
      deleteOperationalDiscountType({
        id: input.id,
        reason: input.reason,
        actor: input.actor,
      }),
  },
  discount: {
    painelPermission: "vis_desc",
    create: async (input) =>
      createOperationalDiscount({
        typeId: input.typeId,
        name: input.name,
        applicationType: input.applicationType,
        value: input.value,
        reason: input.reason,
        actor: input.actor,
      }),
    update: async (input) =>
      updateOperationalDiscount({
        id: input.id,
        typeId: input.typeId,
        name: input.name,
        applicationType: input.applicationType,
        value: input.value,
        reason: input.reason,
        actor: input.actor,
      }),
    remove: async (input) =>
      deleteOperationalDiscount({
        id: input.id,
        reason: input.reason,
        actor: input.actor,
      }),
  },
  courtesy_author: {
    painelPermission: "vis_cort",
    create: async (input) =>
      createOperationalCourtesyAuthor({
        name: input.name,
        reason: input.reason,
        actor: input.actor,
      }),
    update: async (input) =>
      updateOperationalCourtesyAuthor({
        id: input.id,
        name: input.name,
        reason: input.reason,
        actor: input.actor,
      }),
    remove: async (input) =>
      deleteOperationalCourtesyAuthor({
        id: input.id,
        reason: input.reason,
        actor: input.actor,
      }),
  },
};

function readResource(payload: ReferenceDataPayload | null): ReferenceResource | null {
  const resource = String(payload?.resource ?? "").trim();

  if (resource === "courtesyAuthor") {
    return "courtesy_author";
  }

  if (
    resource === "discount_type" ||
    resource === "discount" ||
    resource === "courtesy_author"
  ) {
    return resource;
  }

  return null;
}

function buildMutationInput(payload: ReferenceDataPayload | null): ReferenceMutationInput {
  return {
    id: Number(payload?.id),
    description: readStringOrEmpty(payload?.description),
    typeId: Number(payload?.typeId),
    name: readStringOrEmpty(payload?.name),
    applicationType: readStringOrEmpty(payload?.applicationType),
    value: payload?.value as string | number | null | undefined,
    reason: readStringOrEmpty(payload?.reason),
    actor: readRouteActor(payload?.actor),
  };
}

async function authorizeReferenceMutation(
  request: Request,
  payload: ReferenceDataPayload | null,
) {
  const resource = readResource(payload);
  const config = resource ? resourceConfigs[resource] : null;
  const access = await authorizeOpsRouteAccess(request, {
    requiredPermission: "ops.purchases",
    painelPermissions: config?.painelPermission ?? null,
  });

  return { access, resource, config };
}

export async function GET(request: Request) {
  return runAuthorizedOpsRoute(
    request,
    {
      requiredPermission: "ops.read",
      painelPermissions: ["vis_bilhet", "vis_desc", "vis_cort"],
    },
    () =>
      runOpsRoute(() => getOperationalReferenceData(), {
        mapError: () => ({
          code: "ops_reference_data_unavailable",
          message: "Nao foi possivel carregar descontos e cortesias agora.",
          status: 502,
        }),
        logTag: "ops-reference-data-bff-failed",
      }),
  );
}

export async function POST(request: Request) {
  const payload = await readJsonPayload<ReferenceDataPayload>(request);
  const { access, resource, config } = await authorizeReferenceMutation(
    request,
    payload,
  );

  return !access.ok
    ? access.response
    : !resource || !config
      ? opsErrorResponse("invalid_reference_resource", invalidResourceMessage, 400)
      : runOpsRoute(() => config.create(buildMutationInput(payload)), {
          mapError: asOpsReferenceDataError,
          logTag: "ops-reference-data-create-bff-failed",
        });
}

export async function PATCH(request: Request) {
  const payload = await readJsonPayload<ReferenceDataPayload>(request);
  const { access, resource, config } = await authorizeReferenceMutation(
    request,
    payload,
  );

  return !access.ok
    ? access.response
    : !resource || !config
      ? opsErrorResponse("invalid_reference_resource", invalidResourceMessage, 400)
      : runOpsRoute(() => config.update(buildMutationInput(payload)), {
          mapError: asOpsReferenceDataError,
          logTag: "ops-reference-data-update-bff-failed",
        });
}

export async function DELETE(request: Request) {
  const payload = await readJsonPayload<ReferenceDataPayload>(request);
  const { access, resource, config } = await authorizeReferenceMutation(
    request,
    payload,
  );

  return !access.ok
    ? access.response
    : !resource || !config
      ? opsErrorResponse("invalid_reference_resource", invalidResourceMessage, 400)
      : runOpsRoute(() => config.remove(buildMutationInput(payload)), {
          mapError: asOpsReferenceDataError,
          logTag: "ops-reference-data-delete-bff-failed",
        });
}
