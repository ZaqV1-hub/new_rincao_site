import {
  getCieloSaleByPaymentId,
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

function extractNotificationIdentifiers(payload: unknown) {
  const root = readObject(payload);
  const sale = readObject(root?.Sale) ?? readObject(root?.sale) ?? root;
  const payment = readObject(sale?.Payment) ?? readObject(sale?.payment);
  const paymentId =
    getString(root, ["PaymentId", "paymentId"]) ||
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
  return {
    paymentId: paymentId || null,
    reference: reference || null,
  };
}

async function tryNativeNotificationReconciliation(rawBody: string) {
  let payload: unknown;

  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return false;
  }

  const identifiers = extractNotificationIdentifiers(payload);

  if (!identifiers.paymentId || !isCieloEcommerceConfigured()) {
    return false;
  }

  // Cielo sends PaymentId and ChangeType without the purchase reference.
  // Always query Cielo: notification bodies are not proof of payment.
  const gatewaySale = readObject(
    await getCieloSaleByPaymentId(identifiers.paymentId),
  );
  const gatewayPayment = readObject(gatewaySale?.Payment);
  const gatewayPaymentId = getString(gatewayPayment, ["PaymentId", "paymentId"]);
  const gatewayReference = getString(gatewaySale, [
    "MerchantOrderId",
    "merchantOrderId",
  ]);
  const purchaseId = /^\d+$/.test(gatewayReference)
    ? Number(gatewayReference)
    : null;

  if (
    gatewayPaymentId !== identifiers.paymentId ||
    !purchaseId ||
    !Number.isSafeInteger(purchaseId) ||
    (identifiers.reference && identifiers.reference !== gatewayReference)
  ) {
    return false;
  }

  await reconcilePaymentFromGatewayPayload(gatewaySale, purchaseId);
  return true;
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
