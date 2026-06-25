import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const createOperationalBoxOfficeSale = vi.fn();
const asBoxOfficeSaleError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/ops-box-office-sales", () => ({
  asBoxOfficeSaleError,
  createOperationalBoxOfficeSale,
}));

describe("ops/box-office/sales BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    asBoxOfficeSaleError.mockImplementation((error: Error) => error);
  });

  it("creates a box office sale with operational permission", async () => {
    createOperationalBoxOfficeSale.mockResolvedValue({
      action: "create",
      purchaseId: 321,
      agendaId: 88,
      totalValue: "170.00",
      paymentMethods: ["dinhe", "pix"],
      voucherIds: [9001, 9002],
      voucherCount: 2,
      auditLogId: 1001,
      warnings: [],
      message: "Venda de bilheteria registrada com sucesso.",
    });

    const { POST } = await import("@/app/api/ops/box-office/sales/route");
    const response = await POST(
      new Request("https://example.com/api/ops/box-office/sales", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          agendaId: 88,
          cpf: "529.982.247-25",
          items: [{ type: "norma", quantity: 2, discountId: 7 }],
          courtesies: [{ authorId: 3, quantity: 1 }],
          payments: [
            { method: "dinhe", value: "100,00" },
            { method: "pix", value: "70,00" },
          ],
          reason: "Venda presencial",
          idempotencyKey: "box-sale-20260423-abc123",
          actor: {
            name: "Operador",
            cpf: "52998224725",
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(authenticateOperationsRequest).toHaveBeenCalledWith(
      expect.any(Request),
      { requiredPermission: "ops.purchases" },
    );
    expect(createOperationalBoxOfficeSale).toHaveBeenCalledWith({
      agendaId: 88,
      cpf: "529.982.247-25",
      items: [{ type: "norma", quantity: 2, discountId: 7 }],
      courtesies: [{ authorId: 3, quantity: 1 }],
      payments: [
        { method: "dinhe", value: "100,00" },
        { method: "pix", value: "70,00" },
      ],
      reason: "Venda presencial",
      idempotencyKey: "box-sale-20260423-abc123",
      actor: {
        name: "Operador",
        cpf: "52998224725",
      },
    });
    expect(body.data).toMatchObject({
      action: "create",
      purchaseId: 321,
      voucherIds: [9001, 9002],
      auditLogId: 1001,
    });
  });

  it("normalizes service errors", async () => {
    createOperationalBoxOfficeSale.mockRejectedValue({
      code: "box_office_payment_mismatch",
      message: "Total dos pagamentos nao confere com o total da venda.",
      status: 409,
    });

    const { POST } = await import("@/app/api/ops/box-office/sales/route");
    const response = await POST(
      new Request("https://example.com/api/ops/box-office/sales", {
        method: "POST",
        body: JSON.stringify({
          agendaId: 88,
          items: [{ type: "norma", quantity: 1 }],
          payments: [{ method: "dinhe", value: "1,00" }],
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "box_office_payment_mismatch",
        message: "Total dos pagamentos nao confere com o total da venda.",
      },
    });
  });
});
