import { NextResponse } from "next/server";
import { readJsonPayload } from "@/lib/ops-route-utils";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import {
  asOperationalCashClosureError,
  closeOperationalCashClosure,
} from "@/lib/ops-cash-closures";

export const runtime = "nodejs";

type CloseCashClosurePayload = {
  reason?: unknown;
  operatorName?: unknown;
};

export async function POST(request: Request) {
  const access = await requirePainelApiAccess(request, "vis_bilhet");

  if (!access.ok) {
    return access.response;
  }

  const payload = await readJsonPayload<CloseCashClosurePayload>(request);

  try {
    const result = await closeOperationalCashClosure({
      reason: typeof payload?.reason === "string" ? payload.reason : "",
      operatorName:
        typeof payload?.operatorName === "string" ? payload.operatorName : "",
      actor: {
        name: access.session.actorName,
        cpf: access.session.actorCpf,
      },
    });

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    const operationError = asOperationalCashClosureError(error);

    console.error("painel-bilheteria-cash-close-failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: operationError.code,
          message: operationError.message,
        },
      },
      { status: operationError.status },
    );
  }
}
