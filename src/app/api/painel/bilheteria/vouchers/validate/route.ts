import { NextResponse } from "next/server";
import { readJsonPayload } from "@/lib/ops-route-utils";
import {
  asVoucherOperationError,
  validatePurchaseVouchers,
  validateSchoolTripVouchers,
  validateSelectedVouchers,
  validateVoucherByNumber,
} from "@/lib/ops-voucher-validation";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export const runtime = "nodejs";

type ValidatePayload = {
  voucherNumber?: unknown;
  purchaseId?: unknown;
  schoolId?: unknown;
  agendaId?: unknown;
  voucherIds?: unknown;
  confirm?: unknown;
};

function invalidResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "invalid_operations_payload",
        message:
          "Informe voucherNumber, purchaseId, schoolId+agendaId ou voucherIds para validar.",
      },
    },
    { status: 400 },
  );
}

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

  const payload = await readJsonPayload<ValidatePayload>(request);
  const actor = {
    name: access.session.actorName,
    cpf: access.session.actorCpf,
  };
  const voucherNumber =
    typeof payload?.voucherNumber === "string" ? payload.voucherNumber.trim() : "";
  const purchaseId = Number(payload?.purchaseId);
  const schoolId = Number(payload?.schoolId);
  const agendaId = Number(payload?.agendaId);
  const voucherIds = readVoucherIds(payload?.voucherIds);
  const confirm = payload?.confirm === true;

  try {
    const result = voucherNumber
      ? await validateVoucherByNumber(voucherNumber, confirm, actor)
      : Number.isInteger(purchaseId) && purchaseId > 0
        ? await validatePurchaseVouchers(purchaseId, confirm, actor)
        : Number.isInteger(schoolId) &&
            schoolId > 0 &&
            Number.isInteger(agendaId) &&
            agendaId > 0
          ? await validateSchoolTripVouchers(schoolId, agendaId, actor)
          : voucherIds.length > 0
            ? await validateSelectedVouchers(voucherIds, actor)
            : null;

    if (!result) {
      return invalidResponse();
    }

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    const operationError = asVoucherOperationError(error);

    console.error("painel-bilheteria-voucher-validate-failed", error);

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
