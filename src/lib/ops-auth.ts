import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { getOperationsSessionFromRequest } from "@/lib/ops-session";
import { secureCompare } from "@/lib/secure-compare";
import {
  getPermissionsForOperationsRole,
  hasOperationsPermission,
  normalizeOperationsRole,
  type OperationsPermission,
  type OperationsRole,
} from "@/lib/ops-permissions";

export function getConfiguredOperationsToken() {
  return process.env.INGRESSO_OPERATIONS_API_TOKEN?.trim() ?? "";
}

export function getConfiguredOperationsJobsToken() {
  return process.env.INGRESSO_OPERATIONS_JOBS_TOKEN?.trim() ?? "";
}

export function getConfiguredOperationsBearerRole(): OperationsRole {
  return normalizeOperationsRole(process.env.INGRESSO_OPERATIONS_API_TOKEN_ROLE) ?? "admin";
}

export function validateOperationsBearerToken(token?: string | null) {
  const configuredToken = getConfiguredOperationsToken();
  const normalizedToken = token?.trim() ?? "";

  return Boolean(
    configuredToken &&
      normalizedToken &&
      secureCompare(normalizedToken, configuredToken),
  );
}

export function validateOperationsJobToken(token?: string | null) {
  const configuredToken = getConfiguredOperationsJobsToken();
  const normalizedToken = token?.trim() ?? "";

  return Boolean(
    configuredToken &&
      normalizedToken &&
      secureCompare(normalizedToken, configuredToken),
  );
}

function errorResponse(code: string, message: string, status: number) {
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

export function authenticateOperationsRequest(
  request: Request,
  options?: {
    requiredPermission?: OperationsPermission;
  },
) {
  const configuredToken = getConfiguredOperationsToken();
  const requiredPermission = options?.requiredPermission;

  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() ?? "";

  if (token) {
    if (!configuredToken) {
      return {
        ok: false as const,
        response: errorResponse(
          "operations_auth_not_configured",
          "Autenticacao operacional indisponivel no ambiente atual.",
          503,
        ),
      };
    }

    if (validateOperationsBearerToken(token)) {
      const role = getConfiguredOperationsBearerRole();
      const permissions = getPermissionsForOperationsRole(role);

      if (
        requiredPermission &&
        !hasOperationsPermission(permissions, requiredPermission)
      ) {
        return {
          ok: false as const,
          response: errorResponse(
            "operations_forbidden",
            "Token operacional sem permissao para esta acao.",
            403,
          ),
        };
      }

      return {
        ok: true as const,
        via: "bearer" as const,
        role,
        permissions,
        actorName: null,
        actorCpf: null,
      };
    }

    return {
      ok: false as const,
      response: errorResponse(
        "operations_unauthorized",
        "Token operacional ausente ou invalido.",
        401,
      ),
    };
  }

  const session = getOperationsSessionFromRequest(request);

  if (!session) {
    return {
      ok: false as const,
      response: errorResponse(
        "operations_unauthorized",
        "Token operacional ausente ou invalido.",
        401,
      ),
    };
  }

  if (
    requiredPermission &&
    !hasOperationsPermission(session.permissions, requiredPermission)
  ) {
    return {
      ok: false as const,
      response: errorResponse(
        "operations_forbidden",
        "Sessao operacional sem permissao para esta acao.",
        403,
      ),
    };
  }

  return {
    ok: true as const,
    via: "session" as const,
    role: session.role,
    permissions: session.permissions,
    actorName: session.actorName,
    actorCpf: session.actorCpf,
  };
}

export function authenticateOperationsJobRequest(request: Request) {
  const configuredToken = getConfiguredOperationsJobsToken();

  if (!configuredToken) {
    return {
      ok: false as const,
      response: errorResponse(
        "operations_jobs_auth_not_configured",
        "Autenticacao de jobs operacionais indisponivel no ambiente atual.",
        503,
      ),
    };
  }

  const headerToken =
    request.headers.get("x-ops-jobs-token") ??
    request.headers.get("x-operations-jobs-token") ??
    "";
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = headerToken.trim() || match?.[1]?.trim() || "";

  if (!validateOperationsJobToken(token)) {
    return {
      ok: false as const,
      response: errorResponse(
        "operations_jobs_unauthorized",
        "Token de job operacional ausente ou invalido.",
        401,
      ),
    };
  }

  return {
    ok: true as const,
  };
}
