import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  poolQuery,
  poolConnect,
  poolRelease,
  processConfirmedPurchaseTickets,
  queuePurchaseConfirmationEmail,
  processCodindicaCashback,
  cancelCodindicaCashback,
  registerTicketDeliveryAudit,
} = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  poolConnect: vi.fn(),
  poolRelease: vi.fn(),
  processConfirmedPurchaseTickets: vi.fn(),
  queuePurchaseConfirmationEmail: vi.fn(),
  processCodindicaCashback: vi.fn(),
  cancelCodindicaCashback: vi.fn(),
  registerTicketDeliveryAudit: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    connect: poolConnect,
  }),
}));

vi.mock("@/lib/ticket-service", () => ({
  processConfirmedPurchaseTickets,
}));

vi.mock("@/lib/purchase-confirmation-email", () => ({
  queuePurchaseConfirmationEmail,
}));

vi.mock("@/lib/codindica-cashback", () => ({
  processCodindicaCashback,
  cancelCodindicaCashback,
}));

vi.mock("@/lib/ticket-delivery-audit", () => ({
  registerTicketDeliveryAudit,
}));

describe("payment-reconciliation side effects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    poolConnect.mockResolvedValue({
      query: poolQuery,
      release: poolRelease,
    });
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM compra")) {
        return { rowCount: 1, rows: [{ idcompra: 123 }] };
      }

      if (sql.includes("FROM pagpagseguro")) {
        return { rowCount: 0, rows: [] };
      }

      return { rowCount: 1, rows: [] };
    });
    queuePurchaseConfirmationEmail.mockResolvedValue({
      status: "queued",
      purchaseId: 123,
    });
    processCodindicaCashback.mockResolvedValue(undefined);
    cancelCodindicaCashback.mockResolvedValue(undefined);
    registerTicketDeliveryAudit.mockResolvedValue(undefined);
  });

  it("audits successful automatic ticket delivery after payment confirmation", async () => {
    processConfirmedPurchaseTickets.mockResolvedValue({
      status: "sent",
      purchaseId: 123,
      sentVoucherIds: [9001],
    });

    const { reconcilePaymentFromGatewayPayload } = await import(
      "@/lib/payment-reconciliation"
    );

    await expect(
      reconcilePaymentFromGatewayPayload(
        {
          status: "00",
          dados: {
            code: "payment-123",
            reference: "123",
            status: 3,
            grossAmount: "120.00",
            netAmount: "120.00",
            paymentMethod: {
              type: 11,
              code: 0,
            },
          },
        },
        123,
      ),
    ).resolves.toMatchObject({
      purchaseId: 123,
      purchaseStatus: "conc",
    });

    expect(processConfirmedPurchaseTickets).toHaveBeenCalledWith(123);
    expect(registerTicketDeliveryAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        purchaseId: 123,
        trigger: "payment_reconciliation",
        gatewayPaymentId: "payment-123",
        gatewayStatus: 3,
        result: {
          status: "sent",
          purchaseId: 123,
          sentVoucherIds: [9001],
        },
      }),
    );
  });

  it("audits skipped automatic ticket delivery attempts with the skip reason", async () => {
    processConfirmedPurchaseTickets.mockResolvedValue({
      status: "skipped",
      purchaseId: 123,
      sentVoucherIds: [],
      skippedReason: "no_pending_vouchers",
    });

    const { reconcilePaymentFromGatewayPayload } = await import(
      "@/lib/payment-reconciliation"
    );

    await reconcilePaymentFromGatewayPayload(
      {
        status: "00",
        dados: {
          code: "payment-123",
          reference: "123",
          status: 3,
          grossAmount: "120.00",
          netAmount: "120.00",
          paymentMethod: {
            type: 11,
            code: 0,
          },
        },
      },
      123,
    );

    expect(registerTicketDeliveryAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        purchaseId: 123,
        trigger: "payment_reconciliation",
        result: expect.objectContaining({
          status: "skipped",
          skippedReason: "no_pending_vouchers",
        }),
      }),
    );
  });
});
