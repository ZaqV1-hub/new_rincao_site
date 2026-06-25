import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listPainelInformacoes,
  togglePainelInformacaoStatus,
} from "@/lib/painel-informacoes";
import {
  listOpsAdminMasterData,
  updateOpsAdminMasterData,
} from "@/lib/ops-admin-master-data";

vi.mock("@/lib/ops-admin-master-data", () => ({
  listOpsAdminMasterData: vi.fn(),
  updateOpsAdminMasterData: vi.fn(),
  createOpsAdminMasterData: vi.fn(),
  deleteOpsAdminMasterData: vi.fn(),
  asOpsAdminMasterDataError: vi.fn((error: unknown) => error),
}));

describe("painel-informacoes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lista apenas informacoes ativas por padrao", async () => {
    vi.mocked(listOpsAdminMasterData).mockResolvedValue({
      items: [
        { idinformacao: 1, nome: "Aviso", texto: "Linha 1;Linha 2", status: "ati" },
        { idinformacao: 2, nome: "Oculta", texto: "Interna", status: "ina" },
      ],
      label: "informacao",
      primaryKey: "idinformacao",
      resource: "information",
    });

    const result = await listPainelInformacoes({});

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: 1,
      name: "Aviso",
      status: "ati",
      statusLabel: "Ativo",
    });
  });

  it("alterna o status da informacao atual", async () => {
    vi.mocked(listOpsAdminMasterData).mockResolvedValue({
      items: [
        { idinformacao: 3, nome: "Parque", texto: "Chegue cedo", status: "ati" },
      ],
      label: "informacao",
      primaryKey: "idinformacao",
      resource: "information",
    });

    await togglePainelInformacaoStatus({
      actor: { cpf: "52998224725", name: "Gestor" },
      id: 3,
    });

    expect(updateOpsAdminMasterData).toHaveBeenCalledWith("information", {
      actor: { cpf: "52998224725", name: "Gestor" },
      id: 3,
      values: {
        status: "ina",
      },
    });
  });
});
