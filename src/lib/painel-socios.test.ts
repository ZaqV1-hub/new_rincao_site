import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listPainelSocios,
  validatePainelSocioActivation,
} from "@/lib/painel-socios";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    query: mocks.query,
  }),
}));

vi.mock("@/lib/ops-admin-master-data", () => ({
  listOpsAdminMasterData: vi.fn(async (resource: string) => {
    if (resource === "membership-categories") {
      return {
        resource: "membership-categories",
        label: "categoria de socio",
        primaryKey: "idsociocateg",
        items: [
          { idsociocateg: 3, nmcategoria: "Premium" },
          { idsociocateg: 7, nmcategoria: "Bronze" },
        ],
      };
    }

    throw new Error(`unexpected resource ${resource}`);
  }),
  createOpsAdminMasterData: vi.fn(),
  updateOpsAdminMasterData: vi.fn(),
  deleteOpsAdminMasterData: vi.fn(),
  asOpsAdminMasterDataError: vi.fn((error: unknown) => error),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validatePainelSocioActivation", () => {
  it("bloqueia ativacao com vigencia vencida", () => {
    expect(() =>
      validatePainelSocioActivation({
        status: "ati",
        endDate: "2026-05-10",
        today: "2026-05-10",
      }),
    ).toThrow(/vigencia invalida/i);
  });
});

describe("listPainelSocios", () => {
  it("lista socios com filtro e categorias", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ total: "1" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            cpf: "12345678901",
            nmsocio: "Socio Premium",
            idsociocateg: 3,
            nmcategoria: "Premium",
            dtinisoc: "2026-05-01",
            dtfimsoc: "2026-12-31",
            qtcompradia: 2,
            stsocio: "ati",
            dtcadastro: "2026-05-01",
          },
        ],
      });

    const result = await listPainelSocios({
      idsociocateg: "3",
      stsocio: "-1",
    });

    expect(result.total).toBe(1);
    expect(result.categoryOptions).toEqual([
      { id: 7, name: "Bronze" },
      { id: 3, name: "Premium" },
    ]);
    expect(result.items[0]).toMatchObject({
      cpf: "12345678901",
      cpfLabel: "123.456.789-01",
      categoryName: "Premium",
      statusLabel: "Ativo",
      startDateLabel: "01/05/2026",
      endDateLabel: "31/12/2026",
    });
  });
});
