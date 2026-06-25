import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyAgreementMembersImport,
  createAgreementMember,
  listAgreementMembers,
  previewAgreementMembersImport,
} from "@/lib/ops-agreement-members";

const mocks = vi.hoisted(() => ({
  clientQuery: vi.fn(),
  release: vi.fn(),
  registerOpsAuditLog: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    connect: async () => ({
      query: mocks.clientQuery,
      release: mocks.release,
    }),
  }),
}));

vi.mock("@/lib/ops-audit-log", () => ({
  registerOpsAuditLog: mocks.registerOpsAuditLog,
}));

describe("ops-agreement-members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.registerOpsAuditLog.mockResolvedValue(901);
  });

  it("lists agreement members with optional filters", async () => {
    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM convenio")) {
        return {
          rows: [{ idconvenio: 7, nmconvenio: "Convenio Alfa" }],
        };
      }

      if (sql.includes("FROM conveniado")) {
        return {
          rows: [
            {
              idconvenio: 7,
              nmconvenio: "Convenio Alfa",
              cpf: "52998224725",
              qtcompradia: 2,
              dtiniado: "2026-04-01",
              dtfimado: "2026-05-01",
              stconveniado: "ati",
              nmusuario: "Cliente Conveniado",
            },
          ],
        };
      }

      return { rows: [] };
    });

    await expect(
      listAgreementMembers({
        agreementId: 7,
        status: "ati",
      }),
    ).resolves.toEqual({
      agreementId: 7,
      agreementName: "Convenio Alfa",
      items: [
        {
          agreementId: 7,
          agreementName: "Convenio Alfa",
          cpf: "52998224725",
          dailyPurchaseLimit: 2,
          startDate: "2026-04-01",
          endDate: "2026-05-01",
          status: "ati",
          userName: "Cliente Conveniado",
        },
      ],
      meta: {
        total: 1,
        filters: {
          cpf: null,
          status: "ati",
          startDateFrom: null,
          startDateTo: null,
          endDateFrom: null,
          endDateTo: null,
        },
      },
    });
  });

  it("creates a new agreement member with audit", async () => {
    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("FROM convenio")) {
        return {
          rows: [{ idconvenio: 7, nmconvenio: "Convenio Alfa" }],
        };
      }

      if (sql.includes("WHERE conveniado.idconvenio = $1") && sql.includes("LIMIT 1")) {
        return { rows: [] };
      }

      if (sql.includes("INSERT INTO conveniado")) {
        return { rows: [] };
      }

      if (sql.includes("LEFT JOIN usuario")) {
        return {
          rows: [
            {
              idconvenio: 7,
              nmconvenio: "Convenio Alfa",
              cpf: "52998224725",
              qtcompradia: 2,
              dtiniado: "2026-04-01",
              dtfimado: "2026-05-01",
              stconveniado: "ati",
              nmusuario: "Cliente Conveniado",
            },
          ],
        };
      }

      return { rows: [] };
    });

    await expect(
      createAgreementMember({
        agreementId: 7,
        reason: "Cadastro inicial",
        actor: { name: "Gestor" },
        values: {
          cpf: "529.982.247-25",
          dailyPurchaseLimit: 2,
          startDate: "2026-04-01",
          endDate: "2026-05-01",
          status: "ati",
        },
      }),
    ).resolves.toMatchObject({
      agreementId: 7,
      id: "52998224725",
      action: "create",
      auditLogId: 901,
    });
  });

  it("previews a csv import and marks invalid lines in the log", async () => {
    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM convenio")) {
        return {
          rows: [{ idconvenio: 7, nmconvenio: "Convenio Alfa" }],
        };
      }

      if (sql.includes("cpf = ANY")) {
        return {
          rows: [{ cpf: "52998224725" }],
        };
      }

      return { rows: [] };
    });

    const csvText = [
      "CPF,QTD. COMPRA POR DIA,DATA INICIO,DATA FIM,STATUS",
      "52998224725,2,01/04/2026,01/05/2026,Ativo",
      "111,0,01/04/2026,31/03/2026,X",
    ].join("\n");

    await expect(
      previewAgreementMembersImport({
        agreementId: 7,
        csvText,
      }),
    ).resolves.toMatchObject({
      agreementId: 7,
      totalRows: 2,
      validRows: 1,
      invalidRows: 1,
      rows: [
        expect.objectContaining({
          cpf: "52998224725",
          willUpdate: true,
          errors: [],
        }),
        expect.objectContaining({
          cpf: null,
          errors: expect.arrayContaining([
            "CPF invalido.",
            "Quantidade diaria invalida.",
            "Data final anterior a data inicial.",
            "Status invalido.",
          ]),
        }),
      ],
    });
  });

  it("applies only valid import rows and reports created, updated and skipped counts", async () => {
    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("FROM convenio")) {
        return {
          rows: [{ idconvenio: 7, nmconvenio: "Convenio Alfa" }],
        };
      }

      if (sql.includes("cpf = ANY")) {
        return {
          rows: [{ cpf: "52998224725" }],
        };
      }

      if (sql.includes("LEFT JOIN usuario")) {
        if (sql.includes("AND conveniado.cpf = $2")) {
          return { rows: [] };
        }
      }

      if (sql.includes("UPDATE conveniado")) {
        return { rows: [] };
      }

      if (sql.includes("INSERT INTO conveniado")) {
        return { rows: [] };
      }

      return { rows: [] };
    });

    const csvText = [
      "CPF,QTD. COMPRA POR DIA,DATA INICIO,DATA FIM,STATUS",
      "52998224725,2,01/04/2026,01/05/2026,Ativo",
      "12345678901,1,01/04/2026,10/05/2026,Inativo",
      "111,0,01/04/2026,31/03/2026,X",
    ].join("\n");

    await expect(
      applyAgreementMembersImport({
        agreementId: 7,
        reason: "Carga operacional",
        csvText,
      }),
    ).resolves.toMatchObject({
      agreementId: 7,
      created: 2,
      updated: 0,
      skippedInvalid: 1,
      auditLogId: 901,
    });
  });
});
