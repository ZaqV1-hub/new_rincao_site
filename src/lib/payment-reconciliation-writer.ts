import type { PaymentReconciliationRecord, PaymentReconciliationApplyResult, QueryClient } from "@/lib/payment-reconciliation-contract";
import { mapGatewayStatusToPurchaseStatus } from "@/lib/payment-reconciliation-payload";
import { lockSiteSchoolPayment, queueSiteSchoolPayment } from "@/lib/school-commerce-payment";

export async function applyPaymentReconciliationRecord(
  client: QueryClient,
  record: PaymentReconciliationRecord,
): Promise<PaymentReconciliationApplyResult> {
  const schoolPayment = await lockSiteSchoolPayment(client, record.purchaseId);
  const purchase = await client.query(
    "SELECT idcompra, vltotcompra FROM compra WHERE idcompra = $1 FOR UPDATE",
    [record.purchaseId],
  );

  if (purchase.rowCount === 0) {
    throw new Error("payment_purchase_not_found");
  }

  if (record.purchaseStatus === "conc") {
    const expectedAmount = Number(purchase.rows[0]?.vltotcompra);
    const paidAmount = Number(record.grossAmount);

    if (
      Number.isFinite(expectedAmount) &&
      expectedAmount > 0 &&
      (!Number.isFinite(paidAmount) ||
        Math.abs(Math.round(expectedAmount * 100) - Math.round(paidAmount * 100)) > 1)
    ) {
      throw new Error("payment_amount_mismatch");
    }
  }

  const existingPayment = await client.query(
    `SELECT idpagseguro, status, "grossAmount" AS gross_amount FROM pagpagseguro WHERE idcompra = $1 LIMIT 1`,
    [record.purchaseId],
  );
  const currentPayment = existingPayment.rows[0] as
    | { idpagseguro: string; status: number; gross_amount?: string }
    | undefined;

  // A delayed callback for another attempt cannot overwrite a confirmed
  // charge. A refund of that same charge is still allowed to change status.
  if (
    currentPayment &&
    mapGatewayStatusToPurchaseStatus(currentPayment.status) === "conc" &&
    record.purchaseStatus !== "conc" &&
    (currentPayment.idpagseguro !== record.gatewayPaymentId ||
      record.purchaseStatus === "pend")
  ) {
    return {
      purchaseId: record.purchaseId,
      gatewayPaymentId: currentPayment.idpagseguro,
      gatewayStatus: currentPayment.status,
      purchaseStatus: "conc",
      ledgerAction: "unchanged",
    };
  }
  if (currentPayment && mapGatewayStatusToPurchaseStatus(currentPayment.status) === "conc" &&
      record.purchaseStatus === "conc" && (currentPayment.idpagseguro !== record.gatewayPaymentId ||
        (currentPayment.gross_amount !== undefined && Number(currentPayment.gross_amount) !== Number(record.grossAmount)))) {
    throw new Error("payment_confirmed_charge_conflict");
  }
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

  if (record.purchaseStatus === "conc") await queueSiteSchoolPayment(client, record, schoolPayment);

  return {
    purchaseId: record.purchaseId,
    gatewayPaymentId: record.gatewayPaymentId,
    gatewayStatus: record.status,
    purchaseStatus: record.purchaseStatus,
    ledgerAction: existingPayment.rowCount === 0 ? "inserted" : "updated",
  };
}
