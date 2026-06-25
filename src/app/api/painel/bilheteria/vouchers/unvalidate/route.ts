import { NextResponse } from "next/server";
import { readJsonPayload } from "@/lib/ops-route-utils";
import {
  asVoucherOperationError,
  unvalidatePurchaseVouchers,
  unvalidateSelectedVouchers,
} from "@/lib/ops-voucher-validation";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export const runtime = "nodejs";

type UnvalidatePayload = {
  purchaseId?: unknown;
  voucherIds?: unknown;
};

function readVoucherIds(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((voucherId) => Number(voucherId))
        .filter((voucherId) => Number.isInteger(voucherId) && voucherId > 0)
    : [];
}

export async function POST(request: Request) {
  const access = await requirePainelApiAccess(request, "vis_bilhet");

  if (!access.ok) {
    return access.response;
  }

  const payload = await readJsonPayload<UnvalidatePayload>(request);
  const purchaseId = Number(payload?.purchaseId);
  const voucherIds = readVoucherIds(payload?.voucherIds);
  const actor = {
    name: access.session.actorName,
    cpf: access.session.actorCpf,
  };

  if (voucherIds.length === 0 && (!Number.isInteger(purchaseId) || purchaseId <= 0)) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "invalid_operations_payload",
          message: "Informe voucherIds ou purchaseId para desvalidar.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const result =
      Number.isInteger(purchaseId) && purchaseId > 0
        ? await unvalidatePurchaseVouchers(purchaseId, actor)
        : await unvalidateSelectedVouchers(voucherIds, actor);

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    const operationError = asVoucherOperationError(error);

    console.error("painel-bilheteria-voucher-unvalidate-failed", error);

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
