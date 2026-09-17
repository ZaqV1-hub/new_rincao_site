import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getUserVoucherExportData,
  getUserVouchersPage,
  getUserVoucherRescheduleData,
  resetVoucherLifecycleSchemaForTests,
} from "@/lib/voucher-repository";

const dbQuery = vi.fn();
const { getSchoolVoucherInformation } = vi.hoisted(() => ({
  getSchoolVoucherInformation: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoSistemaDbDialect: () => "postgres",
  getIngressoSistemaDbPool: () => ({
    query: dbQuery,
  }),
}));

vi.mock("@/lib/school-voucher-information", () => ({
  getSchoolVoucherInformation,
}));

describe("voucher-repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSchoolVoucherInformation.mockResolvedValue("");
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

  it("uses the school information as the extra page content when exporting a school voucher", async () => {
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
            vltotcompra: "45.00",
            stcompra: "conc",
            status: 3,
            paymentmethodtype: 1,
            voucher_count: "1",
            unused_voucher_count: "1",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            idcompra: 77,
            idvoucher: 11,
            numvoucher: "ESC-11",
            tpvoucher: "escol",
            vlunicompra: "45.00",
            stusado: "n",
            stvoucher: "ativo",
            flreagendado: "n",
            dtuso: null,
            voucherenviado: "n",
            dtvalidade: "2026-05-20",
            dtagenda: "2026-05-01",
            tpagenda: "escol",
            idescola: 12,
            nmescola: "Escola Rincao",
            nomealuno: "Ana Silva",
            nomeeducador: null,
            turma: "4o ano - A",
            ensino_tipo: "fund1",
            ensino_ano: "4",
            turma_letra: "A",
            descricao: "Escola",
          },
        ],
      });

    getSchoolVoucherInformation.mockResolvedValue("Levar autorização assinada.");

    const result = await getUserVoucherExportData("52998224725", 77, [11]);

    expect(result?.isSchool).toBe(true);
    expect(result?.information).toBe("Levar autorização assinada.");
    expect(getSchoolVoucherInformation).toHaveBeenCalledOnce();
  });
});
