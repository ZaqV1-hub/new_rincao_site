import type { GatewayPurchaseStatus, PaymentReconciliationRecord } from "@/lib/payment-reconciliation-contract";

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function firstObject(...values: unknown[]) {
  for (const value of values) {
    const object = readObject(value);

    if (object) {
      return object;
    }
  }

  return null;
}

function firstArrayObject(value: unknown) {
  return Array.isArray(value) ? readObject(value[0]) : null;
}

function getValue(
  object: Record<string, unknown> | null,
  keys: string[],
): unknown {
  if (!object) {
    return undefined;
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      return object[key];
    }
  }

  return undefined;
}

function getString(object: Record<string, unknown> | null, keys: string[]) {
  const value = getValue(object, keys);

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function getNumber(
  object: Record<string, unknown> | null,
  keys: string[],
  fallback: number,
) {
  const value = getValue(object, keys);
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function normalizeMoney(value: unknown, cents = false) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "0.00";
  }

  return (cents ? numberValue / 100 : numberValue).toFixed(2);
}

function normalizeDate(value: unknown) {
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

function digitsOnly(value: string) {
  return value.replace(/\D+/g, "");
}

function mapCieloStatusToGatewayStatus(status: unknown) {
  if (typeof status === "string" && status.trim() !== "") {
    const stringMap: Record<string, number> = {
      NOTFINISHED: 0,
      AUTHORIZED: 1,
      PAYMENTCONFIRMED: 2,
      PAID: 2,
      CONFIRMED: 2,
      COMPLETED: 2,
      DENIED: 3,
      VOIDED: 10,
      CANCELED: 10,
      CANCELLED: 10,
      REFUNDED: 11,
      PENDING: 12,
      ABORTED: 13,
      SCHEDULED: 20,
    };
    const mapped = stringMap[status.trim().toUpperCase()];

    if (mapped !== undefined) {
      status = mapped;
    }
  }

  const numericStatus = Number(status);
  const numericMap: Record<number, number> = {
    0: 1,
    1: 2,
    2: 3,
    3: 7,
    10: 7,
    11: 6,
    12: 1,
    13: 7,
    14: 1,
    20: 1,
  };

  return numericMap[numericStatus] ?? 1;
}

export function mapGatewayStatusToPurchaseStatus(
  status: number | null,
): GatewayPurchaseStatus {
  if (status === 2 || status === 3 || status === 4) {
    return "conc";
  }

  if (
    status === 6 ||
    status === 7 ||
    status === 8 ||
    status === 10 ||
    status === 11 ||
    status === 13
  ) {
    return "canc";
  }

  if (
    status === 0 ||
    status === 1 ||
    status === 5 ||
    status === 9 ||
    status === 12 ||
    status === 14 ||
    status === 20
  ) {
    return "pend";
  }

  return "unknown";
}

function mapPaymentType(payment: Record<string, unknown> | null) {
  const type = getString(payment, ["PaymentType", "paymentType", "Type", "type"])
    .toLowerCase();

  if (type === "bankslip" || type === "boleto") {
    return 2;
  }

  if (type === "pix") {
    return 11;
  }

  return 1;
}

function mapPaymentCode(payment: Record<string, unknown> | null) {
  const creditCard = firstObject(
    getValue(payment, ["CreditCard"]),
    getValue(payment, ["creditCard"]),
    getValue(payment, ["DebitCard"]),
    getValue(payment, ["debitCard"]),
  );
  const brand = getString(creditCard, ["Brand", "brand"]).toLowerCase();
  const map: Record<string, number> = {
    visa: 101,
    master: 102,
    mastercard: 102,
    americanexpress: 103,
    amex: 103,
    diners: 104,
    elo: 105,
    aura: 106,
    hipercard: 107,
  };

  return map[brand] ?? 0;
}

function normalizeLegacyGatewayPayload(
  payload: Record<string, unknown>,
  expectedPurchaseId: number,
) {
  const paymentMethod = readObject(payload.paymentMethod);
  const sender = readObject(payload.sender);
  const senderPhone = readObject(sender?.phone);
  const shipping = readObject(payload.shipping);
  const shippingAddress = readObject(shipping?.address);
  const reference = getString(payload, ["reference"]);
  const code = getString(payload, ["code"]);
  const extractedPurchaseId = Number(digitsOnly(reference));
  const purchaseId =
    Number.isInteger(extractedPurchaseId) && extractedPurchaseId > 0
      ? extractedPurchaseId
      : expectedPurchaseId;

  if (purchaseId !== expectedPurchaseId) {
    throw new Error("payment_reference_mismatch");
  }

  const status = getNumber(payload, ["status"], 1);

  return {
    purchaseId,
    gatewayPaymentId: code || reference || String(expectedPurchaseId),
    reference: reference || String(expectedPurchaseId),
    status,
    purchaseStatus: mapGatewayStatusToPurchaseStatus(status),
    date: normalizeDate(getValue(payload, ["date"])),
    lastEventDate: normalizeDate(getValue(payload, ["lastEventDate"])),
    paymentMethodType: getNumber(paymentMethod, ["type"], 1),
    paymentMethodCode: getNumber(paymentMethod, ["code"], 0),
    grossAmount: normalizeMoney(getValue(payload, ["grossAmount"])),
    discountAmount: normalizeMoney(getValue(payload, ["discountAmount"])),
    feeAmount: normalizeMoney(getValue(payload, ["feeAmount"])),
    netAmount: normalizeMoney(getValue(payload, ["netAmount"])),
    extraAmount: normalizeMoney(getValue(payload, ["extraAmount"])),
    installmentCount: getNumber(payload, ["installmentCount"], 1),
    senderEmail: getString(sender, ["email"]),
    senderName: getString(sender, ["name"]),
    senderPhoneAreaCode: digitsOnly(getString(senderPhone, ["areaCode"])) || null,
    senderPhoneNumber: digitsOnly(getString(senderPhone, ["number"])) || null,
    shippingType: getNumber(shipping, ["type"], 3),
    shippingCost: normalizeMoney(getValue(shipping, ["cost"])),
    shippingAddressStreet: getString(shippingAddress, ["street"]),
    shippingAddressNumber: getString(shippingAddress, ["number"]),
    shippingAddressDistrict: getString(shippingAddress, ["district"]),
    shippingAddressCity: getString(shippingAddress, ["city"]),
    shippingAddressState: getString(shippingAddress, ["state"]),
    shippingAddressCountry: getString(shippingAddress, ["country"]) || "BRA",
    shippingAddressPostalCode: digitsOnly(
      getString(shippingAddress, ["postalCode"]),
    ),
    xml: typeof payload.xml === "string" ? payload.xml : JSON.stringify(payload),
  } satisfies PaymentReconciliationRecord;
}

function normalizeCieloPayload(
  payload: Record<string, unknown>,
  expectedPurchaseId: number,
) {
  const sale = firstObject(payload.Sale, payload.sale, payload.order, payload);
  const payment = firstObject(
    sale?.Payment,
    sale?.payment,
    firstArrayObject(sale?.payments),
    firstArrayObject(sale?.Payments),
    sale?.paymentData,
  );
  const customer = firstObject(sale?.Customer, sale?.customer, payload.Customer);
  const reference =
    getString(sale, [
      "MerchantOrderId",
      "merchantOrderId",
      "OrderNumber",
      "orderNumber",
      "reference",
      "Reference",
    ]) || String(expectedPurchaseId);
  const extractedPurchaseId = Number(digitsOnly(reference));
  const purchaseId =
    Number.isInteger(extractedPurchaseId) && extractedPurchaseId > 0
      ? extractedPurchaseId
      : expectedPurchaseId;

  if (purchaseId !== expectedPurchaseId) {
    throw new Error("payment_reference_mismatch");
  }

  const gatewayPaymentId =
    getString(payment, ["PaymentId", "paymentId", "Id", "id"]) ||
    getString(sale, ["PaymentId", "paymentId", "Id", "id"]) ||
    reference;
  const status = mapCieloStatusToGatewayStatus(
    getValue(payment, ["Status", "status"]) ??
      getValue(sale, ["Status", "status"]),
  );
  const amountValue =
    getValue(payment, ["Amount", "amount"]) ??
    getValue(sale, ["Amount", "amount"]);

  return {
    purchaseId,
    gatewayPaymentId,
    reference,
    status,
    purchaseStatus: mapGatewayStatusToPurchaseStatus(status),
    date: normalizeDate(
      getValue(payment, [
        "ReceivedDate",
        "receivedDate",
        "CreatedDate",
        "createdDate",
      ]) ??
        getValue(sale, [
          "ReceivedDate",
          "receivedDate",
          "CreatedDate",
          "createdDate",
        ]),
    ),
    lastEventDate: normalizeDate(
      getValue(payment, [
        "CapturedDate",
        "capturedDate",
        "UpdatedDate",
        "updatedDate",
        "ReceivedDate",
        "receivedDate",
        "CreatedDate",
        "createdDate",
      ]) ??
        getValue(sale, [
          "CapturedDate",
          "capturedDate",
          "UpdatedDate",
          "updatedDate",
          "ReceivedDate",
          "receivedDate",
          "CreatedDate",
          "createdDate",
        ]),
    ),
    paymentMethodType: mapPaymentType(payment),
    paymentMethodCode: mapPaymentCode(payment),
    grossAmount: normalizeMoney(amountValue, true),
    discountAmount: "0.00",
    feeAmount: "0.00",
    netAmount: normalizeMoney(amountValue, true),
    extraAmount: "0.00",
    installmentCount: getNumber(payment, ["Installments", "installments"], 1),
    senderEmail: getString(customer, ["Email", "email"]),
    senderName: getString(customer, ["Name", "name"]),
    senderPhoneAreaCode: null,
    senderPhoneNumber: null,
    shippingType: 3,
    shippingCost: "0.00",
    shippingAddressStreet: "",
    shippingAddressNumber: "",
    shippingAddressDistrict: "",
    shippingAddressCity: "",
    shippingAddressState: "",
    shippingAddressCountry: "BRA",
    shippingAddressPostalCode: "0",
    xml: JSON.stringify(payload),
  } satisfies PaymentReconciliationRecord;
}

export function normalizePaymentReconciliationPayload(
  payload: unknown,
  expectedPurchaseId: number,
) {
  const root = readObject(payload);
  const dados = root ? getValue(root, ["dados"]) : undefined;
  const payloadObject = Array.isArray(dados)
    ? readObject(dados[0])
    : readObject(dados) ?? root;

  if (!payloadObject) {
    throw new Error("payment_payload_invalid");
  }

  if (
    Object.prototype.hasOwnProperty.call(payloadObject, "paymentMethod") ||
    Object.prototype.hasOwnProperty.call(payloadObject, "grossAmount") ||
    Object.prototype.hasOwnProperty.call(payloadObject, "code")
  ) {
    return normalizeLegacyGatewayPayload(payloadObject, expectedPurchaseId);
  }

  return normalizeCieloPayload(payloadObject, expectedPurchaseId);
}
