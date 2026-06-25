import {
  getNativeCieloCheckoutStatus,
  isCieloEcommerceConfigured,
} from "@/lib/cielo-ecommerce";
import { isLocalCheckoutMockEnabled } from "@/lib/checkout-mode";
import {
  mapGatewayStatusToPurchaseStatus,
  reconcilePaymentFromGatewayPayload,
  type GatewayPurchaseStatus,
} from "@/lib/payment-reconciliation";
import type { UserVoucherPurchase } from "@/lib/voucher-contracts";

export type CheckoutStatusSyncResult = {
  ok: boolean;
  gatewayStatus: number | null;
  gatewayStatusLabel: string;
  purchaseStatus: GatewayPurchaseStatus;
  raw: unknown;
};

const gatewayStatusLabels: Record<number, string> = {
  1: "Aguardando pagamento",
  2: "Em analise",
  3: "Pago",
  4: "Disponivel",
  5: "Em disputa",
  6: "Devolvido",
  7: "Cancelado",
  8: "Chargeback debitado",
  9: "Em contestacao",
  12: "Pendente",
};

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function readGatewayStatus(payload: unknown) {
  const root = readObject(payload);
  const data = readObject(root?.dados);
  const status = Number(data?.status);

  return Number.isInteger(status) ? status : null;
}

export function mapCheckoutStatusPayload(
  payload: unknown,
): CheckoutStatusSyncResult {
  const root = readObject(payload);
  const gatewayStatus = readGatewayStatus(payload);
  const purchaseStatus = mapGatewayStatusToPurchaseStatus(gatewayStatus);
  const ok = root?.status === "00";

  return {
    ok,
    gatewayStatus,
    gatewayStatusLabel: gatewayStatus
      ? gatewayStatusLabels[gatewayStatus] ?? String(gatewayStatus)
      : "Indisponivel",
    purchaseStatus: ok ? purchaseStatus : "unknown",
    raw: payload,
  };
}

export function buildCheckoutReturnUrl(purchaseId: number, siteUrl: string) {
  return new URL(`/checkout/${purchaseId}/retorno`, siteUrl).toString();
}

function getFirstParam(searchParams: URLSearchParams, keys: string[]) {
  for (const key of keys) {
    const value = searchParams.get(key);

    if (value) {
      return value;
    }
  }

  return null;
}

async function syncNativeCheckoutStatus(
  purchase: Pick<UserVoucherPurchase, "id">,
  searchParams: URLSearchParams,
) {
  if (!isCieloEcommerceConfigured()) {
    return {
      status: 503,
      contentType: "application/json; charset=UTF-8",
      body: {
        ok: false,
        error: {
          code: "checkout_unavailable",
          message: "Checkout nativo indisponivel neste ambiente.",
        },
      },
      mapped: {
        ok: false,
        gatewayStatus: null,
        gatewayStatusLabel: "Indisponivel",
        purchaseStatus: "unknown" as const,
        raw: null,
      },
      reconciliation: null,
    };
  }

  const paymentId = getFirstParam(searchParams, [
    "payment_id",
    "paymentId",
    "transaction_id",
    "order_id",
  ]);
  const reference =
    getFirstParam(searchParams, [
      "reference",
      "merchant_order_id",
      "merchantOrderId",
      "order_number",
      "orderNumber",
    ]) ?? String(purchase.id);
  const body = await getNativeCieloCheckoutStatus({
    paymentId,
    reference,
    purchaseId: purchase.id,
  });
  const mapped = mapCheckoutStatusPayload(body);
  const reconciliation =
    mapped.ok && mapped.purchaseStatus !== "unknown"
      ? await reconcilePaymentFromGatewayPayload(body, purchase.id)
      : null;

  return {
    status: 200,
    contentType: "application/json; charset=UTF-8",
    body,
    mapped,
    reconciliation,
  };
}

async function syncMockCheckoutStatus(
  purchase: Pick<UserVoucherPurchase, "id" | "status">,
) {
  const purchaseStatus =
    purchase.status === "conc" || purchase.status === "canc"
      ? purchase.status
      : "pend";
  const gatewayStatus =
    purchaseStatus === "conc" ? 3 : purchaseStatus === "canc" ? 7 : 1;

  return {
    status: 200,
    contentType: "application/json; charset=UTF-8",
    body: {
      ok: true,
      mock: true,
      purchaseId: purchase.id,
      gatewayStatus,
    },
    mapped: {
      ok: true,
      gatewayStatus,
      gatewayStatusLabel:
        gatewayStatusLabels[gatewayStatus] ?? String(gatewayStatus),
      purchaseStatus,
      raw: {
        mock: true,
        purchaseId: purchase.id,
        gatewayStatus,
      },
    },
    reconciliation: null,
  };
}

export async function syncCheckoutStatus(
  purchase: Pick<UserVoucherPurchase, "id" | "status">,
  searchParams: URLSearchParams,
) {
  if (!isCieloEcommerceConfigured() && isLocalCheckoutMockEnabled()) {
    return syncMockCheckoutStatus(purchase);
  }

  return await syncNativeCheckoutStatus(
    purchase,
    searchParams,
  ).catch((error) => {
    console.error("checkout-status-native-cielo-failed", error);

    return {
      status: 502,
      contentType: "application/json; charset=UTF-8",
      body: {
        ok: false,
        error: {
          code: "checkout_unavailable",
          message: "Nao foi possivel consultar o checkout agora.",
        },
      },
      mapped: {
        ok: false,
        gatewayStatus: null,
        gatewayStatusLabel: "Indisponivel",
        purchaseStatus: "unknown" as const,
        raw: null,
      },
      reconciliation: null,
    };
  });
}
