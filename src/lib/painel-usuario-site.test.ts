import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listPainelUsuariosSite,
  updatePainelUsuarioSiteStatus,
} from "@/lib/painel-usuario-site";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    query: mocks.query,
  }),
}));

vi.mock("@/lib/ops-admin-master-data", () => ({
  updateOpsAdminMasterData: mocks.update,
  asOpsAdminMasterDataError: vi.fn((error: unknown) => error),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listPainelUsuariosSite", () => {
  it("lista usuarios do site com filtro padrao ativo", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ total: "1" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            cpf: "12345678901",
            nmusuario: "Maria Site",
            email: "maria@example.com",
            stusuario: "ati",
            dtcadastro: "2026-05-02",
            dtulogin: null,
            hrulogin: null,
            rg: null,
            dtnascimento: null,
            sexo: null,
            telefone: null,
            celular: null,
            endereco: null,
            numero: null,
            cep: null,
            bairro: null,
            nmcidade: null,
            uf: null,
            complemento: null,
          },
        ],
      });

    const result = await listPainelUsuariosSite({});

    expect(result.filters.stusuario).toBe("ati");
    expect(result.items[0]).toMatchObject({
      cpfLabel: "123.456.789-01",
      name: "Maria Site",
      createdAtLabel: "02/05/2026",
      statusLabel: "Ativo",
    });
  });
});

describe("updatePainelUsuarioSiteStatus", () => {
  it("bloqueia alterar o proprio status", async () => {
    await expect(
      updatePainelUsuarioSiteStatus({
        cpf: "12345678901",
        status: "ina",
        actorCpf: "12345678901",
      }),
    ).rejects.toThrow(/proprio status/i);
  });
});
