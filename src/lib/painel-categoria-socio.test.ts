import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPainelCategoriaSocioFormContext,
  listPainelCategoriasSocio,
} from "@/lib/painel-categoria-socio";
import { listOpsAdminMasterData } from "@/lib/ops-admin-master-data";

vi.mock("@/lib/ops-admin-master-data", () => ({
  listOpsAdminMasterData: vi.fn(),
  updateOpsAdminMasterData: vi.fn(),
  createOpsAdminMasterData: vi.fn(),
  deleteOpsAdminMasterData: vi.fn(),
  asOpsAdminMasterDataError: vi.fn((error: unknown) => error),
}));

vi.mock("@/lib/painel-convenios", () => ({
  listPainelConvenioPriceTableOptions: vi.fn(),
}));

describe("painel-categoria-socio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filtra categorias por tabela de preco", async () => {
    vi.mocked(listOpsAdminMasterData).mockImplementation(
      async (resource: string) => {
      if (resource === "membership-categories") {
        return {
          items: [
            { idsociocateg: 1, nmcategoria: "Premium", idtabpreco: 5 },
            { idsociocateg: 2, nmcategoria: "Basica", idtabpreco: 3 },
          ],
          label: "categoria de socio",
          primaryKey: "idsociocateg",
          resource,
        };
      }

        return {
          items: [
            { idtabpreco: 3, nmtabpreco: "Bronze" },
            { idtabpreco: 5, nmtabpreco: "Ouro" },
          ],
          label: "tabela de preco",
          primaryKey: "idtabpreco",
          resource: "price-tables" as const,
        };
      },
    );

    const result = await listPainelCategoriasSocio({ idtabpreco: "5" });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: 1,
      name: "Premium",
      priceTableId: 5,
      priceTableName: "Ouro",
    });
  });

  it("carrega opcoes de tabela ativas para o formulario", async () => {
    const { listPainelConvenioPriceTableOptions } = await import("@/lib/painel-convenios");
    vi.mocked(listPainelConvenioPriceTableOptions).mockResolvedValue([
      { id: 7, name: "Padrao" },
    ]);

    const result = await getPainelCategoriaSocioFormContext();

    expect(result.priceTableOptions).toEqual([{ id: 7, name: "Padrao" }]);
  });
});
