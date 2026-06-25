import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import {
  clearOperationsSessionCookie,
  createOperationsSessionToken,
  getOperationsSessionFromRequest,
  setOperationsSessionCookie,
  verifyOperationsSessionToken,
} from "@/lib/ops-session";
import {
  getConfiguredOperationsToken,
  validateOperationsBearerToken,
} from "@/lib/ops-auth";

export const runtime = "nodejs";

type SessionPayload = {
  token?: unknown;
  actorName?: unknown;
  actorCpf?: unknown;
};

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

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function buildSessionData(session: NonNullable<ReturnType<typeof getOperationsSessionFromRequest>>) {
  return {
    authenticated: true,
    actorName: session.actorName,
    actorCpf: session.actorCpf,
    role: session.role,
    permissions: session.permissions,
  };
}

export async function GET(request: Request) {
  const session = getOperationsSessionFromRequest(request);

  if (!session) {
    return errorResponse(
      "operations_unauthenticated",
      "Sessao operacional nao encontrada ou expirada.",
      401,
    );
  }

  return NextResponse.json({
    ok: true,
    data: buildSessionData(session),
  });
}

export async function POST(request: Request) {
  const configuredToken = getConfiguredOperationsToken();

  if (!configuredToken) {
    return errorResponse(
      "operations_auth_not_configured",
      "Autenticacao operacional indisponivel no ambiente atual.",
      503,
    );
  }

  let payload: SessionPayload | null = null;

  try {
    payload = (await request.json()) as SessionPayload;
  } catch {
    payload = null;
  }

  const token = typeof payload?.token === "string" ? payload.token.trim() : "";

  if (!validateOperationsBearerToken(token)) {
    return errorResponse(
      "operations_unauthorized",
      "Token operacional ausente ou invalido.",
      401,
    );
  }

  const actorName = normalizeOptionalText(payload?.actorName);
  const actorCpf = normalizeOptionalText(payload?.actorCpf);
  const sessionToken = createOperationsSessionToken({
    actorName,
    actorCpf,
  });
  const session = verifyOperationsSessionToken(sessionToken);

  if (!session) {
    return errorResponse(
      "operations_session_invalid",
      "Nao foi possivel abrir a sessao operacional.",
      500,
    );
  }

  const response = NextResponse.json({
    ok: true,
    data: buildSessionData(session),
  });

  setOperationsSessionCookie(response, sessionToken);

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({
    ok: true,
    data: {
      authenticated: false,
    },
  });

  clearOperationsSessionCookie(response);

  return response;
}
