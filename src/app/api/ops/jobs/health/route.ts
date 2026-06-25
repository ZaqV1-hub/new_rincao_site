import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { authenticateOperationsRequest } from "@/lib/ops-auth";
import { getOperationalJobHealth } from "@/lib/ops-job-runs";

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
  const jobName = String(url.searchParams.get("jobName") ?? "daily-run").trim();
  const triggerSource =
    url.searchParams.get("triggerSource") === "manual" ? "manual" : "scheduled";
  const maxAgeMinutes = Number(url.searchParams.get("maxAgeMinutes") ?? 1560);

  try {
    const data = await getOperationalJobHealth({
      jobName,
      triggerSource,
      maxAgeMinutes,
    });

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    console.error("ops-job-health-bff-failed", error);

    return errorResponse(
      "ops_job_health_unavailable",
      "Nao foi possivel carregar a saude do job operacional.",
      502,
    );
  }
}
