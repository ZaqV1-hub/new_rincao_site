import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listPainelTabelaPreco,
  togglePainelTabelaPrecoStatus,
} from "@/lib/painel-tabela-preco";
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

describe("painel-tabela-preco", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lista apenas tabelas ativas por padrao", async () => {
    vi.mocked(listOpsAdminMasterData).mockResolvedValue({
      items: [
        {
          idtabpreco: 1,
          nmtabpreco: "Padrao",
          vlnormal: "100.00",
          vlinfant: "70.00",
          vlnormalbil: "110.00",
          vlinfantbil: "80.00",
          sttabpreco: "ati",
        },
        {
          idtabpreco: 2,
          nmtabpreco: "Encerrada",
          vlnormal: "90.00",
          vlinfant: "60.00",
          vlnormalbil: "95.00",
          vlinfantbil: "65.00",
          sttabpreco: "ina",
        },
      ],
      label: "tabela de preco",
      primaryKey: "idtabpreco",
      resource: "price-tables",
    });

    const result = await listPainelTabelaPreco({});

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: 1,
      name: "Padrao",
      status: "ati",
      statusLabel: "Ativo",
    });
  });

  it("alterna o status da tabela atual", async () => {
    vi.mocked(listOpsAdminMasterData).mockResolvedValue({
      items: [
        {
          idtabpreco: 4,
          nmtabpreco: "Especial",
          vlnormal: "150.00",
          vlinfant: "99.00",
          vlnormalbil: "160.00",
          vlinfantbil: "109.00",
          sttabpreco: "ati",
        },
      ],
      label: "tabela de preco",
      primaryKey: "idtabpreco",
      resource: "price-tables",
    });

    await togglePainelTabelaPrecoStatus({
      actor: { cpf: "52998224725", name: "Gestor" },
      id: 4,
    });

    expect(updateOpsAdminMasterData).toHaveBeenCalledWith("price-tables", {
      actor: { cpf: "52998224725", name: "Gestor" },
      id: 4,
      values: {
        status: "ina",
      },
    });
  });
});
