import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { clearAuthCookie, getAuthSession } from "@/lib/auth-session";
import {
  cancelCieloPayment,
  createNativeCieloCheckout,
  getNativeCieloCheckoutStatus,
} from "@/lib/cielo-ecommerce";
import { isNativeCheckoutConfigured } from "@/lib/checkout-mode";
import { buildCheckoutReturnUrl } from "@/lib/checkout-status";
import { getIngressoDbPool } from "@/lib/ingresso-db";
import {
  mapGatewayStatusToPurchaseStatus,
  reconcilePaymentFromGatewayPayload,
} from "@/lib/payment-reconciliation";
import { getSiteUrl } from "@/lib/site-metadata";
import { getActivePublicUserByCpf } from "@/lib/user-repository";
import { getUserVoucherPurchaseById } from "@/lib/voucher-repository";

export const runtime = "nodejs";

type CheckoutBody = Record<string, unknown> & {
  idcompra?: unknown;
};

type PaymentLedgerRow = {
  idpagseguro: string;
  status: number | null;
  paymentmethodtype: number | null;
};

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

function getPaymentType(payload: CheckoutBody) {
  const payment =
    payload.payment && typeof payload.payment === "object"
      ? (payload.payment as Record<string, unknown>)
      : payload;

  return String(payment.type ?? payment.Type ?? "CreditCard").toLowerCase();
}

async function getLatestPaymentLedger(purchaseId: number) {
  const pool = getIngressoDbPool();
  const result = await pool.query<PaymentLedgerRow>(
    `
      SELECT idpagseguro, status, paymentmethodtype
      FROM pagpagseguro
      WHERE idcompra = $1
      ORDER BY date DESC NULLS LAST, "lastEventDate" DESC NULLS LAST
      LIMIT 1
    `,
    [purchaseId],
  );

  return result.rows[0] ?? null;
}

async function tryCheckoutLock(purchaseId: number) {
  const pool = getIngressoDbPool();
  const result = await pool.query<{ locked: boolean }>(
    "SELECT pg_try_advisory_lock($1, $2) AS locked",
    [94127, purchaseId],
  );

  return result.rows[0]?.locked === true;
}

async function releaseCheckoutLock(purchaseId: number) {
  const pool = getIngressoDbPool();

  await pool.query("SELECT pg_advisory_unlock($1, $2)", [94127, purchaseId]);
}

async function createNativeCheckoutResponse(
  payload: CheckoutBody,
  purchase: { id: number; totalValue: string | null },
) {
  const payment =
    payload.payment && typeof payload.payment === "object"
      ? (payload.payment as Record<string, unknown>)
      : payload;
  const type = getPaymentType(payload);
  const locked = await tryCheckoutLock(purchase.id);

  if (!locked) {
    return NextResponse.json({
      status: "10",
      msg: "Pagamento ja esta sendo processado. Aguarde alguns instantes e tente novamente.",
    });
  }

  try {
    const latestLedger = await getLatestPaymentLedger(purchase.id);
    const latestPurchaseStatus = mapGatewayStatusToPurchaseStatus(
      latestLedger?.status ?? null,
    );

    if (
      type !== "pix" &&
      (latestPurchaseStatus === "pend" || latestPurchaseStatus === "conc")
    ) {
      return NextResponse.json({
        status: "10",
        msg: "Pagamento ja esta em processamento para este pedido. Aguarde alguns instantes e tente novamente.",
      });
    }

    if (
      type === "pix" &&
      latestLedger?.paymentmethodtype === 11 &&
      latestPurchaseStatus === "pend" &&
      latestLedger.idpagseguro
    ) {
      await cancelCieloPayment(latestLedger.idpagseguro);
      const cancelledPixStatus = await getNativeCieloCheckoutStatus({
        paymentId: latestLedger.idpagseguro,
        reference: String(purchase.id),
        purchaseId: purchase.id,
      }).catch(() => null);

      if (cancelledPixStatus?.status === "00") {
        await reconcilePaymentFromGatewayPayload(cancelledPixStatus, purchase.id);
      }
    }

    const checkout = await createNativeCieloCheckout({
      purchaseId: purchase.id,
      amount: purchase.totalValue ?? "0.00",
      customer: {
        name: String(payload.nome ?? payload.name ?? ""),
        email: String(payload.email ?? ""),
        phone: String(payload.telefone ?? payload.phone ?? ""),
        document: String(payload.document ?? payload.cpf ?? ""),
      },
      payment,
      returnUrl: buildCheckoutReturnUrl(purchase.id, getSiteUrl()),
    });

    await reconcilePaymentFromGatewayPayload(checkout, purchase.id);

    return NextResponse.json(checkout);
  } finally {
    await releaseCheckoutLock(purchase.id);
  }
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

  let payload: CheckoutBody | null = null;

  try {
    payload = (await request.json()) as CheckoutBody;
  } catch {
    return errorResponse(
      "invalid_checkout",
      "Nao foi possivel iniciar o checkout seguro.",
      400,
    );
  }

  const purchaseId = Number(payload?.idcompra);

  if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
    return errorResponse(
      "invalid_checkout",
      "Nao foi possivel iniciar o checkout seguro.",
      400,
    );
  }

  try {
    const user = await getActivePublicUserByCpf(session.sub);

    if (!user) {
      const response = errorResponse(
        "unauthenticated",
        "Sessao nao encontrada ou expirada.",
        401,
      );
      clearAuthCookie(response);

      return response;
    }

    const purchase = await getUserVoucherPurchaseById(user.cpf, purchaseId);

    if (!purchase || purchase.type !== "ponli" || purchase.status === "canc") {
      return errorResponse(
        "checkout_unavailable",
        "Esta compra nao esta disponivel para checkout.",
        404,
      );
    }

    if (!isNativeCheckoutConfigured()) {
      return errorResponse(
        "checkout_unavailable",
        "Checkout nativo indisponivel neste ambiente.",
        503,
      );
    }

    return await createNativeCheckoutResponse(payload, {
      id: purchase.id,
      totalValue: purchase.totalValue,
    });
  } catch (error) {
    console.error("checkout-link-native-failed", error);

    return errorResponse(
      "checkout_unavailable",
      "Nao foi possivel iniciar o checkout seguro.",
      502,
    );
  }
}
