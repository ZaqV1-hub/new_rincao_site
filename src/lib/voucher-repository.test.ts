import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getUserVouchersPage,
  getUserVoucherRescheduleData,
  resetVoucherLifecycleSchemaForTests,
} from "@/lib/voucher-repository";

const dbQuery = vi.fn();

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoSistemaDbDialect: () => "postgres",
  getIngressoSistemaDbPool: () => ({
    query: dbQuery,
  }),
}));

describe("voucher-repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetVoucherLifecycleSchemaForTests();
  });

  it("reads voucher description from the voucher table when listing purchases", async () => {
    dbQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ total: "1" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            idcompra: 77,
            tpcompra: "ponli",
            dtcompra: "2026-04-20",
            vltotcompra: "199.90",
            stcompra: "conc",
            status: 3,
            paymentmethodtype: 1,
            voucher_count: "1",
            unused_voucher_count: "1",
          },
        ],
      })
      .mockImplementationOnce(async (sql: string) => {
        expect(sql).toContain("voucher.descricao AS descricao");

        return {
          rows: [
            {
              idcompra: 77,
              idvoucher: 11,
              numvoucher: "ABC123",
              tpvoucher: "norma",
              vlunicompra: "199.90",
              stusado: "n",
              stvoucher: "ativo",
              flreagendado: "n",
              dtuso: null,
              voucherenviado: "n",
              dtvalidade: "2026-05-20",
              dtagenda: "2026-05-01",
              tpagenda: "padra",
              idescola: null,
              nmescola: null,
              nomealuno: null,
              nomeeducador: null,
              turma: null,
              ensino_tipo: null,
              ensino_ano: null,
              turma_letra: null,
              descricao: "Ingresso principal",
            },
          ],
        };
      });

    const page = await getUserVouchersPage("52998224725", 10, 0);

    expect(page.purchases).toHaveLength(1);
    expect(page.purchases[0]?.vouchers[0]?.number).toBe("ABC123");
  });

  it("reads voucher description from the voucher table when loading reschedule data", async () => {
    dbQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockImplementationOnce(async (sql: string) => {
      expect(sql).toContain("voucher.descricao AS descricao");

      return {
        rows: [
          {
            cpf: "52998224725",
            tpcompra: "ponli",
            dtcompra: "2026-04-20",
            stcompra: "conc",
            idcompra: 77,
            idvoucher: 11,
            numvoucher: "ABC123",
            tpvoucher: "norma",
            vlunicompra: "199.90",
            stusado: "n",
            stvoucher: "ativo",
            flreagendado: "n",
            dtuso: null,
            voucherenviado: "n",
            dtvalidade: "2026-05-20",
            dtagenda: "2026-05-01",
            tpagenda: "padra",
            idescola: null,
            nmescola: null,
            nomealuno: null,
            nomeeducador: null,
            turma: null,
            ensino_tipo: null,
            ensino_ano: null,
            turma_letra: null,
            descricao: "Ingresso principal",
            idagenda: 9,
          },
        ],
      };
    });

    const result = await getUserVoucherRescheduleData("52998224725", 11);

    expect(result?.voucher.id).toBe(11);
  });
});
