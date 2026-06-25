import {
  cancelCodindicaCashback,
  processCodindicaCashback,
} from "@/lib/codindica-cashback";
import type { PoolClient } from "pg";
import { getIngressoDbPool } from "@/lib/ingresso-db";
import { queuePurchaseConfirmationEmail } from "@/lib/purchase-confirmation-email";
import { registerTicketDeliveryAudit } from "@/lib/ticket-delivery-audit";
import { processConfirmedPurchaseTickets } from "@/lib/ticket-service";

export type GatewayPurchaseStatus = "conc" | "pend" | "canc" | "unknown";

export type PaymentReconciliationRecord = {
  purchaseId: number;
  gatewayPaymentId: string;
  reference: string;
  status: number;
  purchaseStatus: GatewayPurchaseStatus;
  date: Date;
  lastEventDate: Date;
  paymentMethodType: number;
  paymentMethodCode: number;
  grossAmount: string;
  discountAmount: string;
  feeAmount: string;
  netAmount: string;
  extraAmount: string;
  installmentCount: number;
  senderEmail: string;
  senderName: string;
  senderPhoneAreaCode: string | null;
  senderPhoneNumber: string | null;
  shippingType: number;
  shippingCost: string;
  shippingAddressStreet: string;
  shippingAddressNumber: string;
  shippingAddressDistrict: string;
  shippingAddressCity: string;
  shippingAddressState: string;
  shippingAddressCountry: string;
  shippingAddressPostalCode: string;
  xml: string;
};

type QueryClient = Pick<PoolClient, "query">;

type PaymentReconciliationApplyResult = {
  purchaseId: number;
  gatewayPaymentId: string;
  gatewayStatus: number;
  purchaseStatus: GatewayPurchaseStatus;
  ledgerAction: "inserted" | "updated";
};

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

export async function applyPaymentReconciliationRecord(
  client: QueryClient,
  record: PaymentReconciliationRecord,
): Promise<PaymentReconciliationApplyResult> {
  const purchase = await client.query(
    "SELECT idcompra FROM compra WHERE idcompra = $1 FOR UPDATE",
    [record.purchaseId],
  );

  if (purchase.rowCount === 0) {
    throw new Error("payment_purchase_not_found");
  }

  const existingPayment = await client.query(
    "SELECT idpagseguro FROM pagpagseguro WHERE idcompra = $1 LIMIT 1",
    [record.purchaseId],
  );
  const paymentValues = [
    record.purchaseId,
    record.gatewayPaymentId,
    record.date,
    record.reference,
    record.status,
    "",
    record.lastEventDate,
    record.paymentMethodType,
    record.paymentMethodCode,
    record.grossAmount,
    record.discountAmount,
    record.feeAmount,
    record.netAmount,
    record.extraAmount,
    record.installmentCount,
    record.senderEmail,
    record.senderName,
    record.senderPhoneAreaCode,
    record.senderPhoneNumber,
    record.shippingType,
    record.shippingCost,
    record.shippingAddressStreet,
    record.shippingAddressNumber,
    record.shippingAddressDistrict,
    record.shippingAddressCity,
    record.shippingAddressState,
    record.shippingAddressCountry,
    record.shippingAddressPostalCode,
    record.xml,
  ];

  if (existingPayment.rowCount === 0) {
    await client.query(
      `
        INSERT INTO pagpagseguro (
          idcompra,
          idpagseguro,
          date,
          reference,
          status,
          "cancellationSource",
          "lastEventDate",
          paymentmethodtype,
          "paymentMethodCode",
          "grossAmount",
          "discountAmount",
          "feeAmount",
          "netAmount",
          "extraAmount",
          "installmentCount",
          "senderEmail",
          "senderName",
          "senderPhoneAreaCode",
          "senderPhoneNumber",
          "shippingType",
          "shippingCost",
          "shippingAdressStreet",
          "shippingAdressNumber",
          "shippingAdressDistrict",
          "shippingAdressCity",
          "shippingAdressState",
          "shippingAdressCountry",
          "shippingAdressPostalCode",
          "xmlRequisicao"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24, $25, $26, $27, $28, $29
        )
      `,
      paymentValues,
    );
  } else {
    await client.query(
      `
        UPDATE pagpagseguro
        SET
          idpagseguro = $2,
          date = $3,
          reference = $4,
          status = $5,
          "cancellationSource" = $6,
          "lastEventDate" = $7,
          paymentmethodtype = $8,
          "paymentMethodCode" = $9,
          "grossAmount" = $10,
          "discountAmount" = $11,
          "feeAmount" = $12,
          "netAmount" = $13,
          "extraAmount" = $14,
          "installmentCount" = $15,
          "senderEmail" = $16,
          "senderName" = $17,
          "senderPhoneAreaCode" = $18,
          "senderPhoneNumber" = $19,
          "shippingType" = $20,
          "shippingCost" = $21,
          "shippingAdressStreet" = $22,
          "shippingAdressNumber" = $23,
          "shippingAdressDistrict" = $24,
          "shippingAdressCity" = $25,
          "shippingAdressState" = $26,
          "shippingAdressCountry" = $27,
          "shippingAdressPostalCode" = $28,
          "xmlRequisicao" = $29
        WHERE idcompra = $1
      `,
      paymentValues,
    );
  }

  if (record.purchaseStatus === "conc") {
    await client.query(
      `
        UPDATE compra
        SET
          stcompra = 'conc',
          dtpagamento = COALESCE(dtpagamento, ($2::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date),
          hrpagamento = COALESCE(hrpagamento, ($2::timestamptz AT TIME ZONE 'America/Sao_Paulo')::time)
        WHERE idcompra = $1
      `,
      [record.purchaseId, record.lastEventDate.toISOString()],
    );
  } else if (
    record.purchaseStatus === "pend" ||
    record.purchaseStatus === "canc"
  ) {
    await client.query(
      `
        UPDATE compra
        SET stcompra = CASE
          WHEN stcompra = 'conc' AND $2 = 'pend' THEN stcompra
          ELSE $2
        END
        WHERE idcompra = $1
      `,
      [record.purchaseId, record.purchaseStatus],
    );
  }

  return {
    purchaseId: record.purchaseId,
    gatewayPaymentId: record.gatewayPaymentId,
    gatewayStatus: record.status,
    purchaseStatus: record.purchaseStatus,
    ledgerAction: existingPayment.rowCount === 0 ? "inserted" : "updated",
  };
}

export async function reconcilePaymentFromGatewayPayload(
  payload: unknown,
  expectedPurchaseId: number,
) {
  const record = normalizePaymentReconciliationPayload(
    payload,
    expectedPurchaseId,
  );
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await applyPaymentReconciliationRecord(client, record);
    await client.query("COMMIT");

    if (result.purchaseStatus === "conc") {
      await processConfirmedPurchaseTickets(result.purchaseId)
        .then(async (ticketResult) => {
          console.info("confirmed-purchase-ticket-processing-result", {
            purchaseId: result.purchaseId,
            status: ticketResult.status,
            sentVoucherIds: ticketResult.sentVoucherIds,
            skippedReason: ticketResult.skippedReason ?? null,
          });
          await registerTicketDeliveryAudit({
            purchaseId: result.purchaseId,
            trigger: "payment_reconciliation",
            gatewayPaymentId: result.gatewayPaymentId,
            gatewayStatus: result.gatewayStatus,
            result: ticketResult,
          }).catch((error) => {
            console.error("confirmed-purchase-ticket-audit-failed", error);
          });
        })
        .catch(async (error) => {
          console.error("confirmed-purchase-ticket-processing-failed", error);
          await registerTicketDeliveryAudit({
            purchaseId: result.purchaseId,
            trigger: "payment_reconciliation",
            gatewayPaymentId: result.gatewayPaymentId,
            gatewayStatus: result.gatewayStatus,
            error,
          }).catch((auditError) => {
            console.error("confirmed-purchase-ticket-audit-failed", auditError);
          });
        });
      await queuePurchaseConfirmationEmail(result.purchaseId).catch((error) => {
        console.error("confirmed-purchase-email-queue-failed", error);
      });
      await processCodindicaCashback(result.purchaseId).catch((error) => {
        console.error("confirmed-purchase-cashback-processing-failed", error);
      });
    } else if (result.purchaseStatus === "canc") {
      await cancelCodindicaCashback(result.purchaseId).catch((error) => {
        console.error("cancelled-purchase-cashback-processing-failed", error);
      });
    }

    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
