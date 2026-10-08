import { NextResponse } from "next/server";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import { readSchoolPaymentOperations, runSchoolPaymentOperation, SchoolPaymentOperationError } from "@/lib/school-payment-operations";

export const runtime = "nodejs";
type Context = { params: Promise<{ purchaseId: string }> };
const failure = (code: string, message: string, status: number) => NextResponse.json({ ok: false, error: { code, message } }, { status });
const readId = async (context: Context) => Number((await context.params).purchaseId);

export async function GET(request: Request, context: Context) {
  const access = await requirePainelApiAccess(request, "vis_compra");
  if (!access.ok) return access.response;
  const purchaseId = await readId(context);
  if (!Number.isSafeInteger(purchaseId) || purchaseId <= 0) return failure("invalid_purchase", "Compra inválida.", 400);
  try { return NextResponse.json({ ok: true, data: { ...await readSchoolPaymentOperations(purchaseId), canOperate: access.session.permissions.includes("ops.purchases") } }); }
  catch { return failure("school_hold_unavailable", "Não foi possível consultar a retenção.", 503); }
}

export async function POST(request: Request, context: Context) {
  const access = await requirePainelApiAccess(request, "vis_compra");
  if (!access.ok) return access.response;
  if (!access.session.permissions.includes("ops.purchases")) return failure("school_operation_forbidden", "Permissão de operação de compras obrigatória.", 403);
  // Next may expose an internal localhost URL behind the public origin.
  let expectedOrigin: string;
  try { expectedOrigin = new URL(process.env.NEXT_PUBLIC_SITE_URL?.trim() || request.url).origin; }
  catch { return failure("school_operation_origin_configuration", "A origem pública do painel precisa de configuração.", 503); }
  if (!request.headers.get("origin") || request.headers.get("origin") !== expectedOrigin) {
    return failure("school_operation_origin", "Origem da solicitação inválida.", 403);
  }
  const purchaseId = await readId(context);
  if (!Number.isSafeInteger(purchaseId) || purchaseId <= 0) return failure("invalid_purchase", "Compra inválida.", 400);
  try {
    const body = await request.json();
    if (!body || !["reopen_review", "follow_up"].includes(body.action) || typeof body.reason !== "string" ||
        typeof body.expected_status !== "string" || !Number.isInteger(body.expected_revision)) {
      return failure("school_operation_invalid", "Ação e justificativa obrigatórias.", 400);
    }
    const result = await runSchoolPaymentOperation(purchaseId, { action: body.action, reason: body.reason,
      expected_revision: body.expected_revision, expected_status: body.expected_status },
      { name: access.session.actorName, cpf: access.session.actorCpf });
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    if (error instanceof SchoolPaymentOperationError) return failure(error.code, error.message, error.status);
    if (error instanceof SyntaxError) return failure("school_operation_invalid", "JSON inválido.", 400);
    return failure("school_operation_unavailable", "Não foi possível registrar a operação.", 503);
  }
}
