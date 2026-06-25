import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const validateVoucherByNumber = vi.fn();
const validatePurchaseVouchers = vi.fn();
const validateSchoolTripVouchers = vi.fn();
const validateSelectedVouchers = vi.fn();
const asVoucherOperationError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/ops-voucher-validation", () => ({
  validateVoucherByNumber,
  validatePurchaseVouchers,
  validateSchoolTripVouchers,
  validateSelectedVouchers,
  asVoucherOperationError,
}));

describe("ops/vouchers validate BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    asVoucherOperationError.mockImplementation((error: Error) => error);
  });

  it("validates by voucher number", async () => {
    validateVoucherByNumber.mockResolvedValue({
      action: "validate",
      mode: "voucher_number",
      processedCount: 1,
      affectedVoucherIds: [9001],
      warnings: [],
      message: "A1234 - Voucher Validado com sucesso! Entrada permitida",
    });

    const { POST } = await import("@/app/api/ops/vouchers/validate/route");
    const response = await POST(
      new Request("https://example.com/api/ops/vouchers/validate", {
        method: "POST",
        headers: {
          authorization: "Bearer ops-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          voucherNumber: "A1234",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(authenticateOperationsRequest).toHaveBeenCalledWith(
      expect.any(Request),
      { requiredPermission: "ops.vouchers" },
    );
    expect(validateVoucherByNumber).toHaveBeenCalledWith("A1234", false, {
      name: null,
      cpf: null,
    });
    expect(body).toEqual({
      ok: true,
      data: {
        action: "validate",
        mode: "voucher_number",
        processedCount: 1,
        affectedVoucherIds: [9001],
        warnings: [],
        message: "A1234 - Voucher Validado com sucesso! Entrada permitida",
      },
    });
  });

  it("validates by purchase id with explicit confirmation", async () => {
    validatePurchaseVouchers.mockResolvedValue({
      action: "validate",
      mode: "purchase",
      processedCount: 2,
      affectedVoucherIds: [9001, 9002],
      warnings: [],
      message: "Vouchers validados com sucesso! Entrada permitida.",
    });

    const { POST } = await import("@/app/api/ops/vouchers/validate/route");
    const response = await POST(
      new Request("https://example.com/api/ops/vouchers/validate", {
        method: "POST",
        headers: {
          authorization: "Bearer ops-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          purchaseId: 321,
          confirm: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(validatePurchaseVouchers).toHaveBeenCalledWith(321, true, {
      name: null,
      cpf: null,
    });
  });

  it("rejects payloads without a supported validation target", async () => {
    const { POST } = await import("@/app/api/ops/vouchers/validate/route");
    const response = await POST(
      new Request("https://example.com/api/ops/vouchers/validate", {
        method: "POST",
        headers: {
          authorization: "Bearer ops-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "invalid_operations_payload",
        message:
          "Informe voucherNumber, purchaseId, schoolId+agendaId ou voucherIds para validar.",
      },
    });
  });

  it("validates a school trip by schoolId and agendaId", async () => {
    validateSchoolTripVouchers.mockResolvedValue({
      action: "validate",
      mode: "school_trip",
      processedCount: 3,
      affectedVoucherIds: [1, 2, 3],
      warnings: [],
      message: "Vouchers do passeio validados com sucesso! Entrada permitida.",
    });

    const { POST } = await import("@/app/api/ops/vouchers/validate/route");
    const response = await POST(
      new Request("https://example.com/api/ops/vouchers/validate", {
        method: "POST",
        headers: {
          authorization: "Bearer ops-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          schoolId: 77,
          agendaId: 88,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(validateSchoolTripVouchers).toHaveBeenCalledWith(77, 88, {
      name: null,
      cpf: null,
    });
  });

  it("returns the normalized operational auth failure", async () => {
    authenticateOperationsRequest.mockReturnValue({
      ok: false,
      response: new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "operations_unauthorized",
            message: "Token operacional ausente ou invalido.",
          },
        }),
        {
          status: 401,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    });

    const { POST } = await import("@/app/api/ops/vouchers/validate/route");
    const response = await POST(
      new Request("https://example.com/api/ops/vouchers/validate", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    expect(validateVoucherByNumber).not.toHaveBeenCalled();
  });
});
