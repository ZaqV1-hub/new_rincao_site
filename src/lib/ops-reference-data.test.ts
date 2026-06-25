import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOperationalDiscountType,
  createOperationalCourtesyAuthor,
  createOperationalDiscount,
  deleteOperationalDiscountType,
  deleteOperationalCourtesyAuthor,
  deleteOperationalDiscount,
  getOperationalReferenceData,
  updateOperationalDiscountType,
  updateOperationalDiscount,
} from "@/lib/ops-reference-data";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
  registerOpsAuditLog: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    query: mocks.query,
    connect: async () => ({
      query: mocks.clientQuery,
      release: mocks.release,
    }),
  }),
}));

vi.mock("@/lib/ops-audit-log", () => ({
  registerOpsAuditLog: mocks.registerOpsAuditLog,
}));

describe("ops-reference-data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.registerOpsAuditLog.mockResolvedValue(900);
  });

  it("loads discount types, discounts and courtesy authors", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM descontos_tipos")) {
        return {
          rows: [{ id: 1, descricao: "Meia entrada" }],
        };
      }

      if (sql.includes("FROM descontos")) {
        return {
          rows: [
            {
              id: 7,
              tipo_id: 1,
              nome: "Professor",
              tipo_aplicacao: "percentual",
              valor: "50.00",
              tipo_desc: "Meia entrada",
            },
          ],
        };
      }

      if (sql.includes("FROM cortesias")) {
        return {
          rows: [{ id: 3, nome: "Diretoria" }],
        };
      }

      return { rows: [] };
    });

    await expect(getOperationalReferenceData()).resolves.toEqual({
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
  });

  it("creates a discount type with duplicate protection, audit and fresh reference data", async () => {
    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("FROM descontos_tipos") && sql.includes("LOWER(descricao)")) {
        return { rows: [] };
      }

      if (sql.includes("INSERT INTO descontos_tipos")) {
        return { rows: [{ id: 5 }] };
      }

      if (sql.includes("FROM descontos_tipos")) {
        return { rows: [{ id: 5, descricao: "Campanha escolar" }] };
      }

      if (sql.includes("FROM descontos") || sql.includes("FROM cortesias")) {
        return { rows: [] };
      }

      return { rows: [] };
    });

    await expect(
      createOperationalDiscountType({
        description: "Campanha escolar",
        reason: "Cadastro inicial",
        actor: {
          name: "Gestor",
        },
      }),
    ).resolves.toMatchObject({
      action: "create",
      resource: "discount_type",
      id: 5,
      auditLogId: 900,
      referenceData: {
        discountTypes: [{ id: 5, description: "Campanha escolar" }],
        discounts: [],
        courtesyAuthors: [],
      },
    });
    expect(mocks.registerOpsAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        origem: "ops-reference",
        acao: "discount_type_create",
        motivo: "Cadastro inicial",
        usuarioNome: "Gestor",
      }),
    );
  });

  it("updates a discount type inside one transaction", async () => {
    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("SELECT id FROM descontos_tipos WHERE id")) {
        return { rows: [{ id: 5 }] };
      }

      if (sql.includes("FROM descontos_tipos") && sql.includes("LOWER(descricao)")) {
        return { rows: [] };
      }

      if (sql.includes("FROM descontos_tipos")) {
        return { rows: [{ id: 5, descricao: "Campanha escolar revisada" }] };
      }

      if (sql.includes("FROM descontos") || sql.includes("FROM cortesias")) {
        return { rows: [] };
      }

      return { rows: [] };
    });

    await expect(
      updateOperationalDiscountType({
        id: 5,
        description: "Campanha escolar revisada",
      }),
    ).resolves.toMatchObject({
      action: "update",
      resource: "discount_type",
      id: 5,
    });
    expect(mocks.clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE descontos_tipos"),
      [5, "Campanha escolar revisada"],
    );
  });

  it("blocks discount type deletion when discounts reference it", async () => {
    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("SELECT id FROM descontos_tipos WHERE id")) {
        return { rows: [{ id: 5 }] };
      }

      if (sql.includes("FROM descontos WHERE tipo_id")) {
        return { rows: [{ exists: 1 }] };
      }

      return { rows: [] };
    });

    await expect(
      deleteOperationalDiscountType({
        id: 5,
      }),
    ).rejects.toMatchObject({
      code: "discount_type_in_use",
      status: 409,
    });
  });

  it("creates a discount with validation, audit and fresh reference data", async () => {
    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("SELECT id FROM descontos_tipos")) {
        return { rows: [{ id: 1 }] };
      }

      if (sql.includes("FROM descontos") && sql.includes("LOWER(nome)")) {
        return { rows: [] };
      }

      if (sql.includes("INSERT INTO descontos")) {
        return { rows: [{ id: 7 }] };
      }

      if (sql.includes("FROM descontos_tipos")) {
        return { rows: [{ id: 1, descricao: "Meia entrada" }] };
      }

      if (sql.includes("FROM descontos")) {
        return {
          rows: [
            {
              id: 7,
              tipo_id: 1,
              nome: "Professor",
              tipo_aplicacao: "percentual",
              valor: "50.00",
              tipo_desc: "Meia entrada",
            },
          ],
        };
      }

      if (sql.includes("FROM cortesias")) {
        return { rows: [] };
      }

      return { rows: [] };
    });

    await expect(
      createOperationalDiscount({
        typeId: 1,
        name: "Professor",
        applicationType: "percentual",
        value: "50,00",
        reason: "Cadastro inicial",
        actor: {
          name: "Gestor",
        },
      }),
    ).resolves.toMatchObject({
      action: "create",
      resource: "discount",
      id: 7,
      auditLogId: 900,
      referenceData: {
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
        courtesyAuthors: [],
      },
    });
    expect(mocks.registerOpsAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        origem: "ops-reference",
        acao: "discount_create",
        motivo: "Cadastro inicial",
        usuarioNome: "Gestor",
      }),
    );
    expect(mocks.release).toHaveBeenCalled();
  });

  it("rejects duplicated discount names within the same type", async () => {
    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("SELECT id FROM descontos_tipos")) {
        return { rows: [{ id: 1 }] };
      }

      if (sql.includes("FROM descontos") && sql.includes("LOWER(nome)")) {
        return { rows: [{ id: 7 }] };
      }

      return { rows: [] };
    });

    await expect(
      createOperationalDiscount({
        typeId: 1,
        name: "Professor",
        applicationType: "percentual",
        value: "50",
      }),
    ).rejects.toMatchObject({
      code: "discount_already_exists",
      status: 409,
    });
    expect(mocks.registerOpsAuditLog).not.toHaveBeenCalled();
  });

  it("updates a discount inside one transaction", async () => {
    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("SELECT id FROM descontos WHERE id")) {
        return { rows: [{ id: 7 }] };
      }

      if (sql.includes("SELECT id FROM descontos_tipos")) {
        return { rows: [{ id: 1 }] };
      }

      if (sql.includes("LOWER(nome)")) {
        return { rows: [] };
      }

      if (sql.includes("FROM descontos_tipos")) {
        return { rows: [{ id: 1, descricao: "Meia entrada" }] };
      }

      if (sql.includes("FROM descontos")) {
        return {
          rows: [
            {
              id: 7,
              tipo_id: 1,
              nome: "Professor",
              tipo_aplicacao: "percentual",
              valor: "40.00",
              tipo_desc: "Meia entrada",
            },
          ],
        };
      }

      if (sql.includes("FROM cortesias")) {
        return { rows: [] };
      }

      return { rows: [] };
    });

    await expect(
      updateOperationalDiscount({
        id: 7,
        typeId: 1,
        name: "Professor",
        applicationType: "percentual",
        value: 40,
      }),
    ).resolves.toMatchObject({
      action: "update",
      resource: "discount",
      id: 7,
    });
    expect(mocks.clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE descontos"),
      [7, 1, "Professor", "percentual", "40.00"],
    );
  });

  it("deletes a discount only when no voucher uses it", async () => {
    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("SELECT id FROM descontos WHERE id")) {
        return { rows: [{ id: 7 }] };
      }

      if (sql.includes("FROM voucher WHERE desconto_id")) {
        return { rows: [] };
      }

      if (sql.includes("FROM descontos_tipos")) {
        return { rows: [] };
      }

      if (sql.includes("FROM descontos")) {
        return { rows: [] };
      }

      if (sql.includes("FROM cortesias")) {
        return { rows: [] };
      }

      return { rows: [] };
    });

    await expect(
      deleteOperationalDiscount({
        id: 7,
        reason: "Cadastro duplicado",
      }),
    ).resolves.toMatchObject({
      action: "delete",
      resource: "discount",
      id: 7,
    });
    expect(mocks.clientQuery).toHaveBeenCalledWith("DELETE FROM descontos WHERE id = $1", [
      7,
    ]);
  });

  it("blocks courtesy author deletion when vouchers reference it", async () => {
    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("SELECT id FROM cortesias WHERE id")) {
        return { rows: [{ id: 3 }] };
      }

      if (sql.includes("FROM voucher WHERE autorizado_por_id")) {
        return { rows: [{ exists: 1 }] };
      }

      return { rows: [] };
    });

    await expect(
      deleteOperationalCourtesyAuthor({
        id: 3,
      }),
    ).rejects.toMatchObject({
      code: "courtesy_author_in_use",
      status: 409,
    });
  });

  it("creates a courtesy author with duplicate protection", async () => {
    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("LOWER(nome)")) {
        return { rows: [] };
      }

      if (sql.includes("INSERT INTO cortesias")) {
        return { rows: [{ id: 3 }] };
      }

      if (sql.includes("FROM descontos_tipos") || sql.includes("FROM descontos")) {
        return { rows: [] };
      }

      if (sql.includes("FROM cortesias")) {
        return { rows: [{ id: 3, nome: "Diretoria" }] };
      }

      return { rows: [] };
    });

    await expect(
      createOperationalCourtesyAuthor({
        name: "Diretoria",
      }),
    ).resolves.toMatchObject({
      action: "create",
      resource: "courtesy_author",
      id: 3,
      referenceData: {
        courtesyAuthors: [{ id: 3, name: "Diretoria" }],
      },
    });
  });
});
