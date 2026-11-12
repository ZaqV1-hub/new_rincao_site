import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import { readJsonPayload } from "@/lib/ops-route-utils";
import { asVoucherOperationError, validateVoucherByNumber, validatePurchaseVouchers, validateSchoolTripVouchers, validateSelectedVouchers,
  unvalidatePurchaseVouchers, unvalidateSelectedVouchers, invalidatePurchaseVouchers, invalidateSelectedVouchers } from "@/lib/ops-voucher-validation";
import { VoucherOperationError } from "@/lib/ops-voucher-validation-contract";
import { requireVoucherPeriodId } from "@/lib/ops-voucher-validation-cash";

type Action = "validate" | "unvalidate" | "invalidate";
function privateResponse(response: Response) { response.headers.set("Cache-Control", "private, no-store"); return response; }
function positiveId(value: unknown) { const id = Number(value); return Number.isSafeInteger(id) && id > 0 ? id : 0; }
export async function runOpsVoucherOperationRoute(request: Request, action: Action) {
  try {
    const access = await requirePainelApiAccess(request, "vis_bilhet");
    if (!access.ok) return privateResponse(access.response);
    if (new URL(request.url).search || request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json" || Number(request.headers.get("Content-Length")) > 512000) {
      throw new VoucherOperationError("invalid_operations_payload", "Envie os dados em JSON, sem parâmetros adicionais.", 400);
    }
    const payload = await readJsonPayload<Record<string, unknown>>(request);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new VoucherOperationError("invalid_operations_payload", "Dados da operação inválidos.", 400);
    const voucherNumber = typeof payload.voucherNumber === "string" ? payload.voucherNumber.trim() : "";
    const purchaseId = positiveId(payload.purchaseId); const schoolId = positiveId(payload.schoolId); const agendaId = positiveId(payload.agendaId);
    const voucherIds = Array.isArray(payload.voucherIds) ? payload.voucherIds.map(positiveId) : [];
    if (voucherIds.length > 1000 || voucherIds.some((id) => !id) || !(purchaseId || voucherIds.length || action === "validate" && (voucherNumber || schoolId && agendaId))) {
      throw new VoucherOperationError("invalid_operations_payload", action === "validate" ? "Informe voucherNumber, purchaseId, schoolId+agendaId ou voucherIds para validar." : `Informe voucherIds ou purchaseId para ${action === "unvalidate" ? "desvalidar" : "invalidar"}.`, 400);
    }
    const periodId = requireVoucherPeriodId(payload.periodId);
    const actor = { name: access.session.actorName, cpf: access.session.actorCpf };
    const result = action === "validate"
      ? voucherNumber ? await validateVoucherByNumber(voucherNumber, payload.confirm === true, actor, periodId)
        : purchaseId ? await validatePurchaseVouchers(purchaseId, payload.confirm === true, actor, periodId)
          : schoolId && agendaId ? await validateSchoolTripVouchers(schoolId, agendaId, actor, periodId)
            : await validateSelectedVouchers(voucherIds, actor, periodId)
      : action === "unvalidate" ? purchaseId ? await unvalidatePurchaseVouchers(purchaseId, actor, periodId) : await unvalidateSelectedVouchers(voucherIds, actor, periodId)
        : purchaseId ? await invalidatePurchaseVouchers(purchaseId, actor, periodId) : await invalidateSelectedVouchers(voucherIds, actor, periodId);
    return privateResponse(Response.json({ ok: true, data: result }));
  } catch (error) {
    const operationError = error instanceof VoucherOperationError ? error : asVoucherOperationError(error);
    return privateResponse(Response.json({ ok: false, error: { code: operationError.code, message: operationError.message,
      ...(operationError.details ? { details: operationError.details } : {}) } }, { status: operationError.status }));
  }
}
