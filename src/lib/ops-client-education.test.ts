import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  autocompleteClients,
  createClientClass,
  getClientEducationSummary,
  listClientTypes,
  toggleClientStatus,
} from "@/lib/ops-client-education";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
  registerOpsAuditLog: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    query: mocks.query,
    connect: async () => ({
      query: mocks.query,
      release: mocks.release,
    }),
  }),
}));

vi.mock("@/lib/ops-audit-log", () => ({
  registerOpsAuditLog: mocks.registerOpsAuditLog,
}));

describe("ops-client-education", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.registerOpsAuditLog.mockResolvedValue(451);
  });

  it("lists client types", async () => {
    mocks.query.mockResolvedValue({
      rows: [
        { idtipo: 4, nome: "Escola" },
        { idtipo: 1, nome: "Agencia" },
      ],
    });

    await expect(listClientTypes()).resolves.toEqual([
      { id: 4, name: "Escola" },
      { id: 1, name: "Agencia" },
    ]);
  });

  it("autocompletes clients with type label", async () => {
    mocks.query.mockResolvedValue({
      rows: [
        {
          idcliente: 10,
          nome: "Colegio Alfa",
          idtipo: 4,
          tipo_nome: "Escola",
        },
      ],
    });

    await expect(autocompleteClients("Alfa", 10)).resolves.toEqual([
      {
        id: 10,
        text: "Colegio Alfa (Escola)",
        name: "Colegio Alfa",
        typeId: 4,
        typeName: "Escola",
      },
    ]);
  });

  it("returns the client education summary with classes and periods", async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [
          {
            idcliente: 10,
            nome: "Colegio Alfa",
            status: "true",
            idtipo: 4,
            tipo_nome: "Escola",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            idturma: 3,
            idcliente: 10,
            nome: "5 ano A",
            ordem: 2,
            status: "ati",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            idperiodo: 9,
            idturma: 3,
            nome: "Manha",
            ordem: 1,
            status: "ati",
          },
        ],
      });

    await expect(getClientEducationSummary(10)).resolves.toEqual({
      client: {
        id: 10,
        name: "Colegio Alfa",
        typeId: 4,
        typeName: "Escola",
        isSchool: true,
        active: true,
      },
      standardPeriodOptions: [
        { slug: "manha", name: "Manha", order: 1 },
        { slug: "tarde", name: "Tarde", order: 2 },
        { slug: "noite", name: "Noite", order: 3 },
        { slug: "integral", name: "Integral", order: 4 },
      ],
      classes: [
        {
          id: 3,
          clientId: 10,
          name: "5 ano A",
          order: 2,
          status: "ati",
          periods: [
            {
              id: 9,
              classId: 3,
              name: "Manha",
              order: 1,
              status: "ati",
            },
          ],
        },
      ],
    });
  });

  it("blocks manual class creation for school clients", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("FROM clientes c")) {
        return {
          rows: [
            {
              idcliente: 10,
              nome: "Colegio Alfa",
              status: "true",
              idtipo: 4,
              tipo_nome: "Escola",
            },
          ],
        };
      }

      return { rows: [] };
    });

    await expect(
      createClientClass({
        clientId: 10,
        values: {
          name: "Turma manual",
        },
      }),
    ).rejects.toMatchObject({
      code: "client_class_school_locked",
      status: 400,
    });
  });

  it("toggles client status with audit", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("FROM clientes c")) {
        return {
          rows: [
            {
              idcliente: 21,
              nome: "Cliente Beta",
              status: "true",
              idtipo: 1,
              tipo_nome: "Agencia",
            },
          ],
        };
      }

      if (sql.includes("UPDATE clientes")) {
        return { rows: [] };
      }

      return { rows: [] };
    });

    await expect(
      toggleClientStatus({
        clientId: 21,
        reason: "Inativacao operacional",
        actor: { name: "Gestor" },
      }),
    ).resolves.toMatchObject({
      clientId: 21,
      active: false,
      auditLogId: 451,
      message: "Cliente inativado com sucesso.",
    });
  });
});
