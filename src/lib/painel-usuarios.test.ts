import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPainelUsuario,
  listPainelUsuarios,
  PainelUsuariosError,
  togglePainelUsuarioStatus,
} from "@/lib/painel-usuarios";
import {
  createOpsAdminMasterData,
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

describe("painel-usuarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lista apenas usuarios ativos por padrao", async () => {
    vi.mocked(listOpsAdminMasterData).mockResolvedValue({
      items: [
        {
          cpf: "12345678901",
          nmusuario: "Usuario Ativo",
          email: "ativo@example.com",
          stusuario: "ati",
          idpapel: 1,
        },
        {
          cpf: "10987654321",
          nmusuario: "Usuario Inativo",
          email: "inativo@example.com",
          stusuario: "ina",
          idpapel: 2,
        },
      ],
      label: "usuario interno",
      primaryKey: "cpf",
      resource: "internal-users",
    });

    const result = await listPainelUsuarios({});

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      cpf: "12345678901",
      status: "ati",
      statusLabel: "Ativo",
    });
  });

  it("aceita criar usuario representante", async () => {
    vi.mocked(createOpsAdminMasterData).mockResolvedValue({
      action: "create",
      auditLogId: null,
      id: "00000000004",
      item: null,
      message: "Cadastro criado com sucesso.",
      resource: "internal-users",
    });

    await createPainelUsuario({
      cpf: "000.000.000-04",
      senha: "5979249495",
      csenha: "5979249495",
      nmusuario: "Isaque Viana",
      email: "isaque@cluberincao.com.br",
      idpapel: "4",
    });

    expect(createOpsAdminMasterData).toHaveBeenCalledWith("internal-users", {
      values: {
        cpf: "00000000004",
        password: "5979249495",
        name: "Isaque Viana",
        email: "isaque@cluberincao.com.br",
        roleId: 4,
        status: "ati",
      },
    });
  });

  it("impede alternar o proprio status do usuario logado", async () => {
    await expect(
      togglePainelUsuarioStatus({
        actor: { cpf: "12345678901", name: "Gerente" },
        currentActorCpf: "12345678901",
        cpf: "12345678901",
      }),
    ).rejects.toMatchObject({
      code: "user_self_status_forbidden",
      status: 400,
    } satisfies Partial<PainelUsuariosError>);

    expect(updateOpsAdminMasterData).not.toHaveBeenCalled();
  });
});
