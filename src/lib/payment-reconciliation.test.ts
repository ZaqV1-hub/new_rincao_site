import { describe, expect, it, vi } from "vitest";
import {
  applyPaymentReconciliationRecord,
  mapGatewayStatusToPurchaseStatus,
  normalizePaymentReconciliationPayload,
  type PaymentReconciliationRecord,
} from "@/lib/payment-reconciliation";

function baseRecord(
  overrides: Partial<PaymentReconciliationRecord> = {},
): PaymentReconciliationRecord {
  return {
    purchaseId: 123,
    gatewayPaymentId: "pay-123",
    reference: "123",
    status: 3,
    purchaseStatus: "conc",
    date: new Date("2026-04-23T10:00:00-03:00"),
    lastEventDate: new Date("2026-04-23T10:05:00-03:00"),
    paymentMethodType: 1,
    paymentMethodCode: 101,
    grossAmount: "120.00",
    discountAmount: "0.00",
    feeAmount: "0.00",
    netAmount: "120.00",
    extraAmount: "0.00",
    installmentCount: 1,
    senderEmail: "cliente@example.com",
    senderName: "Cliente Teste",
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
    shippingAddressPostalCode: "",
    xml: "{}",
    ...overrides,
  };
}

describe("payment-reconciliation", () => {
  it("preserves the legacy gateway-to-purchase status map", () => {
    expect(mapGatewayStatusToPurchaseStatus(2)).toBe("conc");
    expect(mapGatewayStatusToPurchaseStatus(3)).toBe("conc");
    expect(mapGatewayStatusToPurchaseStatus(7)).toBe("canc");
    expect(mapGatewayStatusToPurchaseStatus(12)).toBe("pend");
  });

  it("normalizes legacy status payloads returned by the checkout proxy", () => {
    const record = normalizePaymentReconciliationPayload(
      {
        status: "00",
        dados: {
          code: "payment-abc",
          reference: "123",
          status: 3,
          grossAmount: "120.00",
          netAmount: "120.00",
          paymentMethod: {
            type: 1,
            code: 101,
          },
          sender: {
            email: "cliente@example.com",
            name: "Cliente Teste",
            phone: {
              areaCode: "51",
              number: "99999-9999",
            },
          },
        },
      },
      123,
    );

    expect(record).toMatchObject({
      purchaseId: 123,
      gatewayPaymentId: "payment-abc",
      status: 3,
      purchaseStatus: "conc",
      grossAmount: "120.00",
      paymentMethodCode: 101,
      senderPhoneAreaCode: "51",
      senderPhoneNumber: "999999999",
    });
  });

  it("normalizes raw Cielo sale payloads into the same ledger shape", () => {
    const record = normalizePaymentReconciliationPayload(
      {
        MerchantOrderId: "123",
        Payment: {
          PaymentId: "cielo-payment-123",
          Status: 2,
          Amount: 12990,
          PaymentType: "CreditCard",
          Installments: 2,
          CreditCard: {
            Brand: "Visa",
          },
        },
        Customer: {
          Name: "Cliente Teste",
          Email: "cliente@example.com",
        },
      },
      123,
    );

    expect(record).toMatchObject({
      purchaseId: 123,
      gatewayPaymentId: "cielo-payment-123",
      status: 3,
      purchaseStatus: "conc",
      grossAmount: "129.90",
      installmentCount: 2,
      paymentMethodCode: 101,
      shippingAddressPostalCode: "0",
    });
  });

  it("normalizes flat Cielo webhook payloads with root payment status", () => {
    const record = normalizePaymentReconciliationPayload(
      {
        MerchantOrderId: "123",
        PaymentId: "flat-payment-123",
        Status: 2,
        Amount: 9000,
      },
      123,
    );

    expect(record).toMatchObject({
      purchaseId: 123,
      gatewayPaymentId: "flat-payment-123",
      status: 3,
      purchaseStatus: "conc",
      grossAmount: "90.00",
    });
  });

  it("rejects gateway payloads for a different purchase", () => {
    expect(() =>
      normalizePaymentReconciliationPayload(
        {
          dados: {
            reference: "999",
            status: 3,
          },
        },
        123,
      ),
    ).toThrow("payment_reference_mismatch");
  });

  it("inserts a missing payment ledger row and confirms the purchase", async () => {
    const queries: Array<{ sql: string; values?: unknown[] }> = [];
    const client = {
      query: vi.fn(async (sql: string, values?: unknown[]) => {
        queries.push({ sql, values });

        if (sql.includes("FROM compra")) {
          return { rowCount: 1, rows: [{ idcompra: 123 }] };
        }

        if (sql.includes("FROM pagpagseguro")) {
          return { rowCount: 0, rows: [] };
        }

        return { rowCount: 1, rows: [] };
      }),
    };

    const result = await applyPaymentReconciliationRecord(
      client as unknown as Parameters<typeof applyPaymentReconciliationRecord>[0],
      baseRecord(),
    );

    expect(result).toMatchObject({
      ledgerAction: "inserted",
      purchaseStatus: "conc",
    });
    expect(queries.some((query) => query.sql.includes("INSERT INTO pagpagseguro"))).toBe(
      true,
    );
    expect(
      queries.some((query) =>
        query.sql.includes(
          "dtpagamento = COALESCE(dtpagamento, ($2::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date)",
        ),
      ),
    ).toBe(true);
    expect(
      queries.some((query) =>
        query.sql.includes(
          "hrpagamento = COALESCE(hrpagamento, ($2::timestamptz AT TIME ZONE 'America/Sao_Paulo')::time)",
        ),
      ),
    ).toBe(true);
  });

  it("updates existing payment rows idempotently", async () => {
    const queries: Array<{ sql: string; values?: unknown[] }> = [];
    const client = {
      query: vi.fn(async (sql: string, values?: unknown[]) => {
        queries.push({ sql, values });

        if (sql.includes("FROM compra")) {
          return { rowCount: 1, rows: [{ idcompra: 123 }] };
        }

        if (sql.includes("FROM pagpagseguro")) {
          return { rowCount: 1, rows: [{ idpagseguro: "pay-123" }] };
        }

        return { rowCount: 1, rows: [] };
      }),
    };

    const result = await applyPaymentReconciliationRecord(
      client as unknown as Parameters<typeof applyPaymentReconciliationRecord>[0],
      baseRecord({
        status: 12,
        purchaseStatus: "pend",
      }),
    );

    expect(result).toMatchObject({
      ledgerAction: "updated",
      purchaseStatus: "pend",
    });
    expect(queries.some((query) => query.sql.includes("UPDATE pagpagseguro"))).toBe(
      true,
    );
    expect(queries.some((query) => query.sql.includes("stcompra = CASE"))).toBe(
      true,
    );
  });
});
