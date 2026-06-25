import {
  getNativeCieloCheckoutStatus,
  isCieloEcommerceConfigured,
} from "@/lib/cielo-ecommerce";
import { reconcilePaymentFromGatewayPayload } from "@/lib/payment-reconciliation";

export type CheckoutNotificationProxyResult = {
  status: number;
  contentType: string;
  body: string;
};

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function getString(object: Record<string, unknown> | null, keys: string[]) {
  if (!object) {
    return "";
  }

  for (const key of keys) {
    const value = object[key];

    if (value !== null && value !== undefined) {
      return String(value).trim();
    }
  }

  return "";
}

function getStatusValue(object: Record<string, unknown> | null): unknown {
  if (!object) {
    return undefined;
  }

  return object.Status ?? object.status;
}

function extractNotificationIdentifiers(payload: unknown) {
  const root = readObject(payload);
  const sale = readObject(root?.Sale) ?? readObject(root?.sale) ?? root;
  const payment = readObject(sale?.Payment) ?? readObject(sale?.payment);
  const paymentId =
    getString(payment, ["PaymentId", "paymentId", "Id", "id"]) ||
    getString(sale, ["PaymentId", "paymentId", "Id", "id"]);
  const reference =
    getString(sale, [
      "MerchantOrderId",
      "merchantOrderId",
      "OrderNumber",
      "orderNumber",
      "reference",
      "Reference",
    ]) ||
    getString(payment, [
      "MerchantOrderId",
      "merchantOrderId",
      "OrderId",
      "orderId",
    ]);
  const purchaseId = Number(reference.replace(/\D+/g, ""));

  return {
    paymentId: paymentId || null,
    reference: reference || null,
    purchaseId:
      Number.isInteger(purchaseId) && purchaseId > 0 ? purchaseId : null,
  };
}

async function tryNativeNotificationReconciliation(rawBody: string) {
  let payload: unknown;

  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return false;
  }

  const root = readObject(payload);
  const sale = readObject(root?.Sale) ?? readObject(root?.sale) ?? root;
  const payment = readObject(sale?.Payment) ?? readObject(sale?.payment);
  const hasStatus =
    getStatusValue(root) !== undefined ||
    getStatusValue(sale) !== undefined ||
    getStatusValue(payment) !== undefined;
  const identifiers = extractNotificationIdentifiers(payload);

  if (!identifiers.purchaseId) {
    return false;
  }

  if (hasStatus) {
    await reconcilePaymentFromGatewayPayload(payload, identifiers.purchaseId);
    return true;
  }

  if (!isCieloEcommerceConfigured()) {
    return false;
  }

  const statusPayload = await getNativeCieloCheckoutStatus({
    paymentId: identifiers.paymentId,
    reference: identifiers.reference,
    purchaseId: identifiers.purchaseId,
  });

  if (statusPayload.status === "00") {
    await reconcilePaymentFromGatewayPayload(
      statusPayload,
      identifiers.purchaseId,
    );

    return true;
  }

  return false;
}

export async function proxyCheckoutNotification(request: Request) {
  const rawBody = await request.text();
  const handledNatively = await tryNativeNotificationReconciliation(
    rawBody,
  ).catch((error) => {
    console.error("checkout-notification-reconciliation-failed", error);

    return false;
  });

  if (handledNatively) {
    return {
      status: 200,
      contentType: "text/plain; charset=UTF-8",
      body: "ok",
    } satisfies CheckoutNotificationProxyResult;
  }

  return {
    status: 422,
    contentType: "application/json; charset=UTF-8",
    body: JSON.stringify({
      ok: false,
      error: {
        code: "payment_notification_unhandled",
        message: "Notificacao de pagamento nao reconciliada nativamente.",
      },
    }),
  } satisfies CheckoutNotificationProxyResult;
}
