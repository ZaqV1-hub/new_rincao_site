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
    access.response.headers.set("Cache-Control", "private, no-store");
    return access.response;
  }

  if (access.session.legacyRoleId !== 1) {
    return NextResponse.json({ ok: false, error: { code: "manager_required", message: "Somente gestor pode reconciliar o caixa legado." } },
      { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }

  const payload = await readJsonPayload<CloseCashClosurePayload>(request);

  try {
    const result = await closeOperationalCashClosure({
      reason: typeof payload?.reason === "string" ? payload.reason : "",
      operatorName: access.session.actorName || access.session.actorCpf || "",
      actor: {
        name: access.session.actorName,
        cpf: access.session.actorCpf,
      },
    });

    return NextResponse.json({
      ok: true,
      data: result,
    }, { headers: { "Cache-Control": "private, no-store" } });
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
      { status: operationError.status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
