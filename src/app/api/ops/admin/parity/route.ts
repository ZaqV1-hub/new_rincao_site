import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { getPhase7ParityReport } from "@/lib/ops-admin-parity";
import { authenticateOperationsRequest } from "@/lib/ops-auth";

export const runtime = "nodejs";

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

export async function GET(request: Request) {
  const auth = authenticateOperationsRequest(request, {
    requiredPermission: "ops.admin",
  });

  if (!auth.ok) {
    return auth.response;
  }

  try {
    return NextResponse.json({
      ok: true,
      data: getPhase7ParityReport(),
    });
  } catch (error) {
    console.error("ops-admin-parity-bff-failed", error);

    return errorResponse(
      "ops_admin_parity_unavailable",
      "Nao foi possivel carregar a matriz de paridade da Fase 7 agora.",
      502,
    );
  }
}
