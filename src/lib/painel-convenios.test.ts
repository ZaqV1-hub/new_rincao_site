import { describe, expect, it } from "vitest";
import {
  decodeLegacyAgreementId,
  getPainelConvenioDetail,
  listPainelConvenios,
  normalizePainelConvenioListFilters,
  validatePainelConvenioForm,
  validateAgreementActivation,
} from "@/lib/painel-convenios";
import { beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    query: mocks.query,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("normalizePainelConvenioListFilters", () => {
  it("normalizes scalar filters in legacy-compatible shape", () => {
    const filters = normalizePainelConvenioListFilters({
      nmconvenio: "Empresa",
      stconvenio: "ati",
      idtabpreco: "5",
    });

    expect(filters.name).toBe("Empresa");
    expect(filters.status).toBe("ati");
    expect(filters.priceTableId).toBe("5");
    expect(filters.periodFrom).toBeNull();
    expect(filters.periodTo).toBeNull();
    expect(filters.page).toBe(1);
    expect(filters.perPage).toBe(30);
  });

  it("drops sentinel values and keeps explicit page size", () => {
    const filters = normalizePainelConvenioListFilters({
      nmconvenio: "   ",
      stconvenio: "-1",
      idtabpreco: "-1",
      "periodo[de]": "01/05/2026",
      "periodo[ate]": "31/05/2026",
      page: "3",
      pp: "10",
    });

    expect(filters.name).toBeNull();
    expect(filters.status).toBeNull();
    expect(filters.priceTableId).toBeNull();
    expect(filters.periodFrom).toBe("01/05/2026");
    expect(filters.periodTo).toBe("31/05/2026");
    expect(filters.page).toBe(3);
    expect(filters.perPage).toBe(10);
  });
});

describe("decodeLegacyAgreementId", () => {
  it("decodes a positive integer from base64", () => {
    expect(decodeLegacyAgreementId("MTIz")).toBe(123);
  });

  it("returns null for invalid payloads", () => {
    expect(decodeLegacyAgreementId("abc")).toBeNull();
  });
});

describe("validateAgreementActivation", () => {
  it("rejects activation when agreement has expired", () => {
    expect(() =>
      validateAgreementActivation({
        status: "ati",
        endDate: "2026-05-01",
        today: "2026-05-08",
      }),
    ).toThrow(/vigencia invalida/i);
  });
});

describe("validatePainelConvenioForm", () => {
  it("rejects end date before start date", () => {
    expect(() =>
      validatePainelConvenioForm({
        nmconvenio: "Empresa",
        dtini: "10/05/2026",
        dtfim: "09/05/2026",
        idtabpreco: "1",
      }),
    ).toThrow(/data fim/i);
  });
});

describe("listPainelConvenios", () => {
  it("returns legacy rows, pagination, and price tables", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT") && sql.includes("FROM convenio") && sql.includes("LIMIT")) {
        return {
          rows: [
            {
              idconvenio: 7,
              nmconvenio: "Convenio Alfa",
              idtabpreco: 5,
              nmtabpreco: "Tabela Bronze",
              dtini: "2026-05-01",
              dtfim: "2026-05-31",
              stconvenio: "ati",
            },
          ],
        };
      }

      if (sql.includes("COUNT(*)::text AS total")) {
        return { rows: [{ total: "1" }] };
      }

      if (sql.includes("FROM tabpreco")) {
        return {
          rows: [{ idtabpreco: 5, nmtabpreco: "Tabela Bronze" }],
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    const result = await listPainelConvenios({
      filters: {},
    });

    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.priceTableOptions).toEqual([{ id: 5, name: "Tabela Bronze" }]);
    expect(result.items[0]).toMatchObject({
      id: 7,
      name: "Convenio Alfa",
      priceTableName: "Tabela Bronze",
      statusLabel: "Ativo",
    });
  });
});

describe("getPainelConvenioDetail", () => {
  it("returns agreement counts and pricing data", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT") && sql.includes("FROM convenio") && sql.includes("qtdconveniadoati")) {
        return {
          rows: [
            {
              idconvenio: 7,
              nmconvenio: "Convenio Alfa",
              nmtabpreco: "Tabela Bronze",
              dtini: "2026-05-01",
              dtfim: "2026-05-31",
              stconvenio: "ati",
              qtdconveniadoati: "3",
              qtdconveniadoina: "2",
              dtcadastro: "2026-05-06",
            },
          ],
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    const result = await getPainelConvenioDetail("7");
    expect(result).toMatchObject({
      id: 7,
      name: "Convenio Alfa",
      totalMembers: 5,
      activeMembers: 3,
      inactiveMembers: 2,
      priceTableName: "Tabela Bronze",
    });
  });
});
