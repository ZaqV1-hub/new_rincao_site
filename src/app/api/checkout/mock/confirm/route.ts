import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { getAuthSession } from "@/lib/auth-session";
import { confirmSandboxCheckout } from "@/lib/checkout-sandbox";
import { getUserVoucherPurchaseById } from "@/lib/voucher-repository";

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

function successResponse(data: Record<string, unknown>) {
  return NextResponse.json(
    {
      ok: true,
      data,
    },
    { status: 200 },
  );
}

function normalizePaymentType(value: unknown) {
  if (value === "Pix" || value === "CreditCard" || value === "DebitCard") {
    return value;
  }

  return null;
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session) {
    return errorResponse(
      "unauthenticated",
      "Sessao nao encontrada ou expirada.",
      401,
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  const purchaseId = Number(payload?.purchaseId);
  const paymentType = normalizePaymentType(payload?.paymentType);
  const cpf = String(payload?.cpf ?? session.sub ?? "").replace(/\D+/g, "");
  const name = String(payload?.name ?? "").trim();
  const email =
    typeof payload?.email === "string" && payload.email.trim() !== ""
      ? payload.email.trim()
      : null;
  const phone =
    typeof payload?.phone === "string" && payload.phone.trim() !== ""
      ? payload.phone.trim()
      : null;

  if (!Number.isInteger(purchaseId) || purchaseId <= 0 || !paymentType) {
    return errorResponse(
      "invalid_checkout_request",
      "Informe uma compra valida para simular o pagamento.",
      400,
    );
  }

  const purchase = await getUserVoucherPurchaseById(session.sub, purchaseId);

  if (!purchase || purchase.type !== "ponli" || purchase.status === "canc") {
    return errorResponse(
      "purchase_not_found",
      "A compra informada nao esta disponivel para checkout.",
      404,
    );
  }

  const confirmation = await confirmSandboxCheckout({
    purchaseId: purchase.id,
    amount: purchase.totalValue ?? "0.00",
    cpf: cpf || session.sub,
    name: name || "Cliente Estancia",
    email,
    phone,
    paymentType,
  });

  return successResponse({
    purchaseId: confirmation.purchaseId,
    purchaseStatus: confirmation.purchaseStatus,
    gatewayStatus: confirmation.gatewayStatus,
    ledgerAction: confirmation.ledgerAction,
  });
}
