import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { clearAuthCookie, getAuthSession } from "@/lib/auth-session";

export function customerApiErrorResponse(
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

export function parsePositiveRouteId(value: string) {
  return /^\d+$/.test(value) ? Number(value) : null;
}

export async function readCustomerJsonPayload<T>(request: Request) {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export async function requireAuthenticatedCustomerSubject<T>(
  readSubject: (cpf: string) => Promise<T | null>,
) {
  const session = await getAuthSession();

  if (!session) {
    return {
      ok: false as const,
      response: customerApiErrorResponse(
        "unauthenticated",
        "Sessao nao encontrada ou expirada.",
        401,
      ),
    };
  }

  const subject = await readSubject(session.sub);

  if (!subject) {
    const response = customerApiErrorResponse(
      "unauthenticated",
      "Sessao nao encontrada ou expirada.",
      401,
    );
    clearAuthCookie(response);

    return {
      ok: false as const,
      response,
    };
  }

  return {
    ok: true as const,
    session,
    subject,
  };
}
