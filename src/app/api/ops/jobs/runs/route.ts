import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { authenticateOperationsRequest } from "@/lib/ops-auth";
import { listOperationalJobRuns } from "@/lib/ops-job-runs";

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
    requiredPermission: "ops.read",
  });

  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const jobName = url.searchParams.get("jobName");

  try {
    const data = await listOperationalJobRuns({
      limit,
      offset,
      jobName,
    });

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    console.error("ops-job-runs-bff-failed", error);

    return errorResponse(
      "ops_job_runs_unavailable",
      "Nao foi possivel carregar o historico de jobs operacionais.",
      502,
    );
  }
}
