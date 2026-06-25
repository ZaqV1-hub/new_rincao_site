import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const getOperationalReferenceData = vi.fn();
const createOperationalDiscountType = vi.fn();
const createOperationalDiscount = vi.fn();
const updateOperationalDiscountType = vi.fn();
const updateOperationalDiscount = vi.fn();
const deleteOperationalDiscountType = vi.fn();
const deleteOperationalDiscount = vi.fn();
const createOperationalCourtesyAuthor = vi.fn();
const updateOperationalCourtesyAuthor = vi.fn();
const deleteOperationalCourtesyAuthor = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/ops-reference-data", () => ({
  asOpsReferenceDataError: (error: unknown) => error,
  createOperationalDiscountType,
  createOperationalCourtesyAuthor,
  createOperationalDiscount,
  deleteOperationalDiscountType,
  deleteOperationalCourtesyAuthor,
  deleteOperationalDiscount,
  getOperationalReferenceData,
  updateOperationalDiscountType,
  updateOperationalCourtesyAuthor,
  updateOperationalDiscount,
}));

describe("ops/reference-data BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
  });

  it("returns discount, type and courtesy reference data", async () => {
    getOperationalReferenceData.mockResolvedValue({
      discountTypes: [{ id: 1, description: "Meia entrada" }],
      discounts: [
        {
          id: 7,
          typeId: 1,
          typeDescription: "Meia entrada",
          name: "Professor",
          applicationType: "percentual",
          value: "50.00",
        },
      ],
      courtesyAuthors: [{ id: 3, name: "Diretoria" }],
    });

    const { GET } = await import("@/app/api/ops/reference-data/route");
    const response = await GET(
      new Request("https://example.com/api/ops/reference-data", {
        headers: {
          authorization: "Bearer ops-token",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(authenticateOperationsRequest).toHaveBeenCalledWith(
      expect.any(Request),
      { requiredPermission: "ops.read" },
    );
    expect(body).toEqual({
      ok: true,
      data: {
        discountTypes: [{ id: 1, description: "Meia entrada" }],
        discounts: [
          {
            id: 7,
            typeId: 1,
            typeDescription: "Meia entrada",
            name: "Professor",
            applicationType: "percentual",
            value: "50.00",
          },
        ],
        courtesyAuthors: [{ id: 3, name: "Diretoria" }],
      },
    });
  });

  it("returns the normalized auth failure", async () => {
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

    const { GET } = await import("@/app/api/ops/reference-data/route");
    const response = await GET(
      new Request("https://example.com/api/ops/reference-data"),
    );

    expect(response.status).toBe(401);
    expect(getOperationalReferenceData).not.toHaveBeenCalled();
  });

  it("creates a discount with write permission", async () => {
    createOperationalDiscount.mockResolvedValue({
      action: "create",
      resource: "discount",
      id: 7,
      referenceData: {
        discountTypes: [],
        discounts: [],
        courtesyAuthors: [],
      },
      auditLogId: 10,
      message: "Desconto cadastrado com sucesso.",
    });

    const { POST } = await import("@/app/api/ops/reference-data/route");
    const response = await POST(
      new Request("https://example.com/api/ops/reference-data", {
        method: "POST",
        body: JSON.stringify({
          resource: "discount",
          typeId: 1,
          name: "Professor",
          applicationType: "percentual",
          value: "50,00",
          reason: "Cadastro de homologacao",
          actor: {
            name: "Gestor",
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
    expect(createOperationalDiscount).toHaveBeenCalledWith({
      typeId: 1,
      name: "Professor",
      applicationType: "percentual",
      value: "50,00",
      reason: "Cadastro de homologacao",
      actor: {
        name: "Gestor",
        cpf: null,
      },
    });
    expect(body.data).toMatchObject({
      action: "create",
      resource: "discount",
      id: 7,
      auditLogId: 10,
    });
  });

  it("creates a discount type with write permission", async () => {
    createOperationalDiscountType.mockResolvedValue({
      action: "create",
      resource: "discount_type",
      id: 5,
      referenceData: {
        discountTypes: [{ id: 5, description: "Campanha escolar" }],
        discounts: [],
        courtesyAuthors: [],
      },
      auditLogId: 13,
      message: "Tipo de desconto cadastrado com sucesso.",
    });

    const { POST } = await import("@/app/api/ops/reference-data/route");
    const response = await POST(
      new Request("https://example.com/api/ops/reference-data", {
        method: "POST",
        body: JSON.stringify({
          resource: "discount_type",
          description: "Campanha escolar",
          reason: "Cadastro de homologacao",
          actor: {
            cpf: "52998224725",
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(createOperationalDiscountType).toHaveBeenCalledWith({
      description: "Campanha escolar",
      reason: "Cadastro de homologacao",
      actor: {
        name: null,
        cpf: "52998224725",
      },
    });
    expect(body.data).toMatchObject({
      action: "create",
      resource: "discount_type",
      id: 5,
      auditLogId: 13,
    });
  });

  it("updates a courtesy author", async () => {
    updateOperationalCourtesyAuthor.mockResolvedValue({
      action: "update",
      resource: "courtesy_author",
      id: 3,
      referenceData: {
        discountTypes: [],
        discounts: [],
        courtesyAuthors: [{ id: 3, name: "Diretoria" }],
      },
      auditLogId: 11,
      message: "Autorizador de cortesia alterado com sucesso.",
    });

    const { PATCH } = await import("@/app/api/ops/reference-data/route");
    const response = await PATCH(
      new Request("https://example.com/api/ops/reference-data", {
        method: "PATCH",
        body: JSON.stringify({
          resource: "courtesy_author",
          id: 3,
          name: "Diretoria",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updateOperationalCourtesyAuthor).toHaveBeenCalledWith({
      id: 3,
      name: "Diretoria",
      reason: "",
      actor: {
        name: null,
        cpf: null,
      },
    });
  });

  it("updates a discount type", async () => {
    updateOperationalDiscountType.mockResolvedValue({
      action: "update",
      resource: "discount_type",
      id: 5,
      referenceData: {
        discountTypes: [{ id: 5, description: "Campanha escolar revisada" }],
        discounts: [],
        courtesyAuthors: [],
      },
      auditLogId: 14,
      message: "Tipo de desconto alterado com sucesso.",
    });

    const { PATCH } = await import("@/app/api/ops/reference-data/route");
    const response = await PATCH(
      new Request("https://example.com/api/ops/reference-data", {
        method: "PATCH",
        body: JSON.stringify({
          resource: "discount_type",
          id: 5,
          description: "Campanha escolar revisada",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updateOperationalDiscountType).toHaveBeenCalledWith({
      id: 5,
      description: "Campanha escolar revisada",
      reason: "",
      actor: {
        name: null,
        cpf: null,
      },
    });
  });

  it("deletes a discount", async () => {
    deleteOperationalDiscount.mockResolvedValue({
      action: "delete",
      resource: "discount",
      id: 7,
      referenceData: {
        discountTypes: [],
        discounts: [],
        courtesyAuthors: [],
      },
      auditLogId: 12,
      message: "Desconto excluido com sucesso.",
    });

    const { DELETE } = await import("@/app/api/ops/reference-data/route");
    const response = await DELETE(
      new Request("https://example.com/api/ops/reference-data", {
        method: "DELETE",
        body: JSON.stringify({
          resource: "discount",
          id: 7,
          reason: "Remocao de cadastro duplicado",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(deleteOperationalDiscount).toHaveBeenCalledWith({
      id: 7,
      reason: "Remocao de cadastro duplicado",
      actor: {
        name: null,
        cpf: null,
      },
    });
  });

  it("deletes a discount type", async () => {
    deleteOperationalDiscountType.mockResolvedValue({
      action: "delete",
      resource: "discount_type",
      id: 5,
      referenceData: {
        discountTypes: [],
        discounts: [],
        courtesyAuthors: [],
      },
      auditLogId: 15,
      message: "Tipo de desconto excluido com sucesso.",
    });

    const { DELETE } = await import("@/app/api/ops/reference-data/route");
    const response = await DELETE(
      new Request("https://example.com/api/ops/reference-data", {
        method: "DELETE",
        body: JSON.stringify({
          resource: "discount_type",
          id: 5,
          reason: "Cadastro duplicado",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(deleteOperationalDiscountType).toHaveBeenCalledWith({
      id: 5,
      reason: "Cadastro duplicado",
      actor: {
        name: null,
        cpf: null,
      },
    });
  });

  it("normalizes reference write failures", async () => {
    createOperationalCourtesyAuthor.mockRejectedValue({
      code: "courtesy_author_already_exists",
      message: "Ja existe alguem cadastrado com esse nome.",
      status: 409,
    });

    const { POST } = await import("@/app/api/ops/reference-data/route");
    const response = await POST(
      new Request("https://example.com/api/ops/reference-data", {
        method: "POST",
        body: JSON.stringify({
          resource: "courtesy_author",
          name: "Diretoria",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "courtesy_author_already_exists",
        message: "Ja existe alguem cadastrado com esse nome.",
      },
    });
  });
});
