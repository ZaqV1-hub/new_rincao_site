import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOpsAdminMasterData,
  getOpsAdminMasterDataResources,
  updateOpsAdminMasterData,
} from "@/lib/ops-admin-master-data";

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

describe("ops-admin-master-data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.registerOpsAuditLog.mockResolvedValue(900);
  });

  it("exposes the administrative resources with metadata for keys and actions", () => {
    const resources = getOpsAdminMasterDataResources();

    expect(resources.map((resource) => resource.resource).sort()).toEqual(
      [
        "agenda",
        "agreements",
        "clients",
        "information",
        "internal-users",
        "members",
        "membership-categories",
        "price-tables",
        "schools",
        "site-users",
      ].sort(),
    );
    expect(
      resources.find((resource) => resource.resource === "internal-users"),
    ).toEqual(
      expect.objectContaining({
        primaryKey: "cpf",
        primaryKeyType: "text",
        supportedActions: ["create", "update", "delete"],
        fields: expect.arrayContaining([
          expect.objectContaining({
            name: "password",
            type: "password",
            writeOnly: true,
          }),
          expect.objectContaining({
            name: "roleId",
            type: "integer",
            allowedIntegers: [1, 2, 3],
          }),
        ]),
      }),
    );
    expect(resources.find((resource) => resource.resource === "site-users")).toEqual(
      expect.objectContaining({
        primaryKeyType: "text",
        supportedActions: ["update"],
      }),
    );
    expect(resources.find((resource) => resource.resource === "members")).toEqual(
      expect.objectContaining({
        fields: expect.arrayContaining([
          expect.objectContaining({
            name: "cpf",
            type: "cpf",
          }),
          expect.objectContaining({
            name: "status",
            type: "status",
            allowed: ["ati", "ina"],
          }),
        ]),
      }),
    );
  });

  it("promotes an existing site user into an internal user while hashing the password", async () => {
    mocks.clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("FROM usuario") && sql.includes("FOR UPDATE")) {
        return {
          rows: [
            {
              cpf: "52998224725",
              idpapel: null,
              email: "cliente@site.test",
            },
          ],
        };
      }

      if (sql.includes("UPDATE usuario")) {
        expect(params).toEqual([
          "52998224725",
          "52998224725",
          "5f4dcc3b5aa765d61d8327deb882cf99",
          "Gestor Interno",
          1,
          "ati",
        ]);
        return { rows: [] };
      }

      if (sql.includes("WHERE cpf = $1 AND (idpapel IS NOT NULL)")) {
        return {
          rows: [
            {
              cpf: "52998224725",
              nmusuario: "Gestor Interno",
              idpapel: 1,
              stusuario: "ati",
              email: "cliente@site.test",
              senha: "3c6e0b8a9c15224a8228b9a98ca1531d",
            },
          ],
        };
      }

      return { rows: [] };
    });

    await expect(
      createOpsAdminMasterData("internal-users", {
        reason: "Promocao de acesso interno",
        actor: { name: "Admin" },
        values: {
          cpf: "529.982.247-25",
          password: "password",
          name: "Gestor Interno",
          roleId: 1,
        },
      }),
    ).resolves.toMatchObject({
      resource: "internal-users",
      id: "52998224725",
      action: "create",
      item: {
        cpf: "52998224725",
        nmusuario: "Gestor Interno",
        idpapel: 1,
        stusuario: "ati",
      },
      auditLogId: 900,
    });

    expect(mocks.registerOpsAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        origem: "ops-admin",
        acao: "master_create",
        usuarioNome: "Admin",
      }),
    );
    expect(mocks.release).toHaveBeenCalled();
  });

  it("updates a site user by cpf without requiring create/delete support", async () => {
    mocks.clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("SELECT cpf") && sql.includes("idpapel IS NULL")) {
        return { rows: [{ cpf: "52998224725" }] };
      }

      if (sql.includes("UPDATE usuario")) {
        expect(params).toEqual(["52998224725", "ajuste@site.test", "ina"]);
        return { rows: [] };
      }

      if (sql.includes("SELECT *") && sql.includes("idpapel IS NULL")) {
        return {
          rows: [
            {
              cpf: "52998224725",
              nmusuario: "Cliente Site",
              email: "ajuste@site.test",
              stusuario: "ina",
              idpapel: null,
            },
          ],
        };
      }

      return { rows: [] };
    });

    await expect(
      updateOpsAdminMasterData("site-users", {
        id: "52998224725",
        reason: "Ajuste de cadastro",
        values: {
          email: "ajuste@site.test",
          status: "ina",
        },
      }),
    ).resolves.toMatchObject({
      resource: "site-users",
      id: "52998224725",
      action: "update",
      item: {
        cpf: "52998224725",
        email: "ajuste@site.test",
        stusuario: "ina",
      },
    });
  });

  it("rejects member date ranges where the end is earlier than the start", async () => {
    await expect(
      createOpsAdminMasterData("members", {
        values: {
          cpf: "52998224725",
          startDate: "2026-05-10",
          endDate: "2026-05-09",
          name: "Socio Teste",
          dailyPurchaseLimit: 1,
          categoryId: 2,
        },
      }),
    ).rejects.toMatchObject({
      code: "invalid_admin_master_data_payload",
      status: 400,
    });
  });
});
