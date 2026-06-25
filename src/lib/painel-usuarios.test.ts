import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listPainelUsuarios,
  PainelUsuariosError,
  togglePainelUsuarioStatus,
} from "@/lib/painel-usuarios";
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
