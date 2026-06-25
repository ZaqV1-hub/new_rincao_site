import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { authenticateOperationsRequest } from "@/lib/ops-auth";
import type { OperationsPermission } from "@/lib/ops-permissions";
import type { LegacyPanelResource } from "@/lib/painel-access";
import { authorizePainelApiAccess } from "@/lib/painel-api-auth";

type RouteActorInput =
  | {
      name?: unknown;
      cpf?: unknown;
    }
  | null
  | undefined;

type OpsRouteAccessOptions = {
  requiredPermission: OperationsPermission;
  painelPermissions?:
    | LegacyPanelResource
    | LegacyPanelResource[]
    | readonly LegacyPanelResource[]
    | null;
};

type OpsRouteError = {
  code: string;
  message: string;
  status: number;
};

export function opsErrorResponse(
  code: string,
  message: string,
  status: number,
) {
  return NextResponse.json<AuthErrorResponse>(
    {
      ok: false,
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

export function opsOkResponse<T>(data: T) {
  return NextResponse.json({
    ok: true,
    data,
  });
}

export async function authorizeOpsRouteAccess(
  request: Request,
  options: OpsRouteAccessOptions,
) {
  const auth = authenticateOperationsRequest(request, {
    requiredPermission: options.requiredPermission,
  });

  if (!auth.ok) {
    return auth;
  }

  const painelPermissions = options.painelPermissions;
  let painelPermissionInput:
    | LegacyPanelResource
    | LegacyPanelResource[]
    | null
    | undefined;

  if (Array.isArray(painelPermissions)) {
    painelPermissionInput = Array.from(painelPermissions);
  } else {
    painelPermissionInput = painelPermissions as
      | LegacyPanelResource
      | null
      | undefined;
  }

  if (
    !painelPermissionInput ||
    (Array.isArray(painelPermissionInput) && painelPermissionInput.length === 0)
  ) {
    return { ok: true as const };
  }

  const painelAuth = await authorizePainelApiAccess(
    request,
    painelPermissionInput,
  );

  if (!painelAuth.ok) {
    return painelAuth;
  }

  return { ok: true as const };
}

export async function runAuthorizedOpsRoute<TResponse>(
  request: Request,
  options: OpsRouteAccessOptions,
  action: () => Promise<TResponse>,
) {
  const access = await authorizeOpsRouteAccess(request, options);

  if (!access.ok) {
    return access.response;
  }

  return action();
}

export async function runOpsRoute<TData>(
  action: () => Promise<TData>,
  options: {
    mapError: (error: unknown) => OpsRouteError;
    logTag?: string;
  },
) {
  try {
    return opsOkResponse(await action());
  } catch (error) {
    const operationError = options.mapError(error);

    if (options.logTag) {
      console.error(options.logTag, error);
    }

    return opsErrorResponse(
      operationError.code,
      operationError.message,
      operationError.status,
    );
  }
}

export async function readJsonPayload<T>(request: Request) {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function readRouteActor(actor: RouteActorInput) {
  return {
    name: typeof actor?.name === "string" ? actor.name.trim() : null,
    cpf: typeof actor?.cpf === "string" ? actor.cpf.trim() : null,
  };
}

export async function readRouteParams<TParams extends Record<string, string>>(context: {
  params: Promise<TParams>;
}) {
  return context.params;
}

export function readStringOrEmpty(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function readIdentifier(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? value : null;
}

export function readRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export function createCsvFileResponse(filename: string, content: string) {
  return new NextResponse(`\uFEFF${content}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}

export function createInlinePdfResponse(filename: string, pdfBuffer: Buffer) {
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${filename}"`,
    },
  });
}
