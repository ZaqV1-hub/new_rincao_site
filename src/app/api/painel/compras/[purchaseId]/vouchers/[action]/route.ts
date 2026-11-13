import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import { asVoucherOperationError, validateSelectedVouchers, unvalidateSelectedVouchers } from "@/lib/ops-voucher-validation";
import { VoucherOperationError } from "@/lib/ops-voucher-validation-contract";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 65536;
function privateResponse(response: Response) { response.headers.set("Cache-Control", "private, no-store"); return response; }
// The existing purchase, voucher and cash period keys are PostgreSQL INTEGERs.
function isId(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 2147483647; }
function invalidInput(): never { throw new VoucherOperationError("invalid_operations_payload", "Informe a compra, os vouchers selecionados e um caixa válido, sem campos adicionais.", 400); }


async function readBody(request: Request) {
  if (new URL(request.url).search || request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json" ||
    Number(request.headers.get("Content-Length")) > MAX_BODY_BYTES || !request.body) invalidInput();
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let total = 0, text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > MAX_BODY_BYTES) invalidInput();
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    await reader.cancel().catch(() => undefined);
    return invalidInput();
  } finally { reader.releaseLock(); }
}

export async function POST(request: Request, context: { params: Promise<{ purchaseId: string; action: string }> }) {
  try {
    const access = await requirePainelApiAccess(request, "vis_compra");
    if (!access.ok) return privateResponse(access.response);
    if (!access.legacyResources.includes("vis_bilhet")) {
      throw new VoucherOperationError("painel_forbidden", "Permissão de bilheteria obrigatória para esta operação.", 403);
    }
    const { purchaseId: rawPurchaseId, action } = await context.params;
    const purchaseId = Number(rawPurchaseId);
    if (!/^[1-9]\d*$/.test(rawPurchaseId) || !isId(purchaseId) || (action !== "validate" && action !== "unvalidate")) invalidInput();
    const payload = await readBody(request);
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || Object.keys(payload).some((key) => key !== "voucherIds" && key !== "periodId")) invalidInput();
    const { voucherIds, periodId } = payload;
    if (!Array.isArray(voucherIds) || voucherIds.length === 0 || voucherIds.length > 1000 || !voucherIds.every(isId) || new Set(voucherIds).size !== voucherIds.length || !isId(periodId)) invalidInput();
    const actor = { name: access.session.actorName, cpf: access.session.actorCpf };
    const result = await (action === "validate" ? validateSelectedVouchers : unvalidateSelectedVouchers)(voucherIds, actor, periodId, purchaseId);
    return privateResponse(Response.json({ ok: true, data: result }));
  } catch (error) {
    const operationError = asVoucherOperationError(error);
    return privateResponse(Response.json({ ok: false, error: { code: operationError.code, message: operationError.message,
      ...(operationError.details ? { details: operationError.details } : {}) } }, { status: operationError.status }));
  }
}
