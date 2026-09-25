import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { clearAuthCookie, getAuthSession } from "@/lib/auth-session";
import {
  cancelCieloPayment,
  createNativeCieloCheckout,
  getNativeCieloCheckoutStatus,
} from "@/lib/cielo-ecommerce";
import { isNativeCheckoutConfigured } from "@/lib/checkout-mode";
import { buildCheckoutReturnUrl } from "@/lib/checkout-status";
import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
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

async function getLatestPaymentLedger(client: PoolClient, purchaseId: number) {
  const result = await client.query<PaymentLedgerRow>(
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

async function tryCheckoutLock(client: PoolClient, purchaseId: number) {
  const result = await client.query<{ locked: boolean }>(
    "SELECT pg_try_advisory_lock($1, $2) AS locked",
    [94127, purchaseId],
  );

  return result.rows[0]?.locked === true;
}

async function releaseCheckoutLock(client: PoolClient, purchaseId: number) {
  await client.query("SELECT pg_advisory_unlock($1, $2)", [94127, purchaseId]);
}

function checkoutStatusData(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  if (root.status !== "00" || !root.dados || typeof root.dados !== "object") {
    return null;
  }

  const dados = root.dados as Record<string, unknown>;
  const status = Number(dados.status);
  return Number.isInteger(status)
    ? { paymentId: String(dados.code ?? ""), status }
    : null;
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
  const client = await getIngressoSistemaDbPool().connect();
  let locked = false;

  try {
    locked = await tryCheckoutLock(client, purchase.id);

    if (!locked) {
      return NextResponse.json({
        status: "10",
        msg: "Pagamento ja esta sendo processado. Aguarde alguns instantes e tente novamente.",
      });
    }

    const latestLedger = await getLatestPaymentLedger(client, purchase.id);
    const latestPurchaseStatus = mapGatewayStatusToPurchaseStatus(
      latestLedger?.status ?? null,
    );

    if (latestPurchaseStatus === "conc") {
      return NextResponse.json({
        status: "10",
        msg: "Esta compra ja foi paga. Consulte seus ingressos antes de tentar novamente.",
      });
    }

    if (
      type !== "pix" &&
      latestPurchaseStatus === "pend"
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
      const previousPixStatus = await getNativeCieloCheckoutStatus({
        paymentId: latestLedger.idpagseguro,
        reference: String(purchase.id),
        purchaseId: purchase.id,
      });
      const previousPix = checkoutStatusData(previousPixStatus);

      if (!previousPix) {
        return NextResponse.json({
          status: "10",
          msg: "Nao foi possivel confirmar o Pix anterior. Aguarde e tente novamente.",
        });
      }

      if (mapGatewayStatusToPurchaseStatus(previousPix.status) === "conc") {
        await reconcilePaymentFromGatewayPayload(previousPixStatus, purchase.id);
        return NextResponse.json({
          status: "10",
          msg: "Esta compra ja foi paga. Consulte seus ingressos antes de tentar novamente.",
        });
      }

      if (
        mapGatewayStatusToPurchaseStatus(previousPix.status) === "pend" &&
        previousPix.paymentId === latestLedger.idpagseguro
      ) {
        await cancelCieloPayment(latestLedger.idpagseguro);
      }

      const cancelledPixStatus = await getNativeCieloCheckoutStatus({
        paymentId: latestLedger.idpagseguro,
        reference: String(purchase.id),
        purchaseId: purchase.id,
      });
      const cancelledPix = checkoutStatusData(cancelledPixStatus);

      if (!cancelledPix) {
        return NextResponse.json({
          status: "10",
          msg: "Nao foi possivel confirmar o Pix anterior. Aguarde e tente novamente.",
        });
      }

      await reconcilePaymentFromGatewayPayload(cancelledPixStatus, purchase.id);

      // A refund means the old Pix may have been paid during the retry.
      // Only a voided/denied attempt can be replaced automatically.
      if (cancelledPix.status !== 7) {
        return NextResponse.json({
          status: "10",
          msg: "O Pix anterior ainda esta em processamento. Aguarde a confirmacao antes de tentar novamente.",
        });
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
    try {
      if (locked) await releaseCheckoutLock(client, purchase.id);
    } finally {
      client.release();
    }
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

    if (
      !purchase ||
      purchase.type !== "ponli" ||
      purchase.status === "canc" ||
      purchase.status === "conc"
    ) {
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
