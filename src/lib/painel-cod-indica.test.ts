import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPainelCodIndicaDetail,
  getPainelCodIndicaMessage,
  listPainelCodIndica,
  payPainelCodIndicaCashback,
  type PainelCodIndicaCashbackPaymentValues,
} from "@/lib/painel-cod-indica";

const dbQuery = vi.fn();

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    query: dbQuery,
  }),
}));

vi.mock("@/lib/codindica-cashback", () => ({
  processCodindicaCashback: vi.fn(async (purchaseId: number) => ({
    status: "processed",
    purchaseId,
    amount: "10.00",
  })),
  cancelCodindicaCashback: vi.fn(),
}));

describe("painel-cod-indica", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lista codigos com paginacao e labels", async () => {
    dbQuery.mockResolvedValueOnce({
      rows: [
        {
          codindica: "ABC123",
          nmrepresentante: "Maria",
          validade: "2026-12-31",
          stcodindica: "ati",
        },
      ],
    });

    await expect(listPainelCodIndica({ page: "1", filters: {} })).resolves.toMatchObject({
      total: 1,
      items: [
        {
          codigo: "ABC123",
          representante: "Maria",
          validadeLabel: "31/12/2026",
          statusLabel: "Ativo",
        },
      ],
    });
  });

  it("carrega mensagens personalizadas dos parametros", async () => {
    dbQuery.mockResolvedValueOnce({
      rows: [
        { idparametro: "codval", vlparametro: "valido" },
        { idparametro: "codven", vlparametro: "vencido" },
        { idparametro: "codine", vlparametro: "inexistente" },
      ],
    });

    await expect(getPainelCodIndicaMessage()).resolves.toEqual({
      codval: "valido",
      codven: "vencido",
      codine: "inexistente",
    });
  });

  it("bloqueia pagamento de cashback acima do disponivel", async () => {
    const values: PainelCodIndicaCashbackPaymentValues = {
      vlpagamento: "100,00",
      senha_admin: "12345",
      dsobservacao: "",
    };

    dbQuery
      .mockResolvedValueOnce({
        rows: [
          {
            codindica: "ABC123",
            nmrepresentante: "Maria",
            email: "maria@example.com",
            validade: "2026-12-31",
            stcodindica: "ati",
            vlvendanormal: "50.00",
            vlvendainfant: "25.00",
            vlcashbacknormal: "10.00",
            vlcashbackinfant: "5.00",
            flpromocional: "n",
            vldescpromonormal: "0.00",
            vlcashbackpromonormal: "0.00",
            vlcashbackpromoinfant: "0.00",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ vlparametro: "12345" }] })
      .mockResolvedValueOnce({ rows: [{ total: "10.00" }] })
      .mockResolvedValueOnce({ rows: [{ total: "0.00" }] });

    await expect(
      payPainelCodIndicaCashback("ABC123", values, { roleId: 1 }),
    ).rejects.toMatchObject({
      code: "cashback_amount_exceeds_available",
    });
  });

  it("carrega detalhe com pagamentos e compras", async () => {
    dbQuery
      .mockResolvedValueOnce({
        rows: [
          {
            codindica: "ABC123",
            nmrepresentante: "Maria",
            email: "maria@example.com",
            validade: "2026-12-31",
            stcodindica: "ati",
            vlvendanormal: "50.00",
            vlvendainfant: "25.00",
            vlcashbacknormal: "10.00",
            vlcashbackinfant: "5.00",
            flpromocional: "n",
            vldescpromonormal: "0.00",
            vlcashbackpromonormal: "0.00",
            vlcashbackpromoinfant: "0.00",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ total: "10.00" }] })
      .mockResolvedValueOnce({ rows: [{ total: "5.00" }] })
      .mockResolvedValueOnce({
        rows: [{ total_pagas: "50.00", total_nao_pagas: "0.00", total_desconto: "10.00" }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            idpagamento: 1,
            dtpagamento: "2026-05-10",
            hrpagamento: "10:00:00",
            vlpagamento: "5.00",
            nmgerente: "Gerente",
            dsobservacao: "Obs",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            idcompra: 7,
            dtcompra: "2026-05-09",
            hrcompra: "09:00:00",
            cpf: "12345678901",
            nmusuario: "Cliente",
            status: "3",
            paymentmethodtype: "1",
            formapag: "credi",
            dtpagamento: "2026-05-09",
            hrpagamento: "09:10:00",
            vltotcompra: "40.00",
            vltotdesc: "10.00",
            vlcashback: "0.00",
            stcompra: "conc",
          },
        ],
      });

    await expect(getPainelCodIndicaDetail("ABC123")).resolves.toMatchObject({
      codigo: "ABC123",
      statusLabel: "Ativo",
      payments: [{ gerente: "Gerente" }],
      purchases: [{ purchaseId: 7, canReprocess: true }],
    });
  });
});
