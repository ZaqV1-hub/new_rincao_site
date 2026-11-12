import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getUserVoucherExportData,
  getUserVouchersPage,
  getUserVoucherRescheduleData,
  ensureVoucherLifecycleSchema,
  resetVoucherLifecycleSchemaForTests,
  expireUnusedVouchers,
  rescheduleUserVoucher,
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

  it("retries schema initialization after a transient database failure", async () => {
    dbQuery.mockRejectedValueOnce(new Error("timeout exceeded when trying to connect"));
    await expect(ensureVoucherLifecycleSchema()).rejects.toThrow("timeout exceeded");

    dbQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    await Promise.all([ensureVoucherLifecycleSchema(), ensureVoucherLifecycleSchema()]);
    expect(dbQuery).toHaveBeenCalledTimes(3);
    await ensureVoucherLifecycleSchema();
    expect(dbQuery).toHaveBeenCalledTimes(3);
  });

  it("retries when only the second schema change fails", async () => {
    dbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockRejectedValueOnce(new Error("connection interrupted"));
    await expect(ensureVoucherLifecycleSchema()).rejects.toThrow("connection interrupted");
    dbQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    await ensureVoucherLifecycleSchema();
    expect(dbQuery).toHaveBeenCalledTimes(4);
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
            dtcompra: "2025-10-06",
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
            dtvalidade: "2026-11-20",
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


describe("operational voucher presentation", () => {
  beforeEach(() => {
    vi.clearAllMocks(); resetVoucherLifecycleSchemaForTests();
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-04-27T01:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    ["2026-04-20", "2026-04-26", false, false, false],
    ["2026-04-20", "2026-04-26", false, false, true],
    ["2026-04-20", "2026-04-25", true, false, false],
    [null, "2026-04-25", false, true, false],
  ])("preserves snapshot end and disables rescheduling (%s, %s)", async (start, end, expired, reschedule, held) => {
    dbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT COUNT")) return { rows: [{ total: "1" }] };
      if (sql.includes("COUNT(voucher.idvoucher)")) return { rows: [{ idcompra: 77, tpcompra: "ponli", dtcompra: "2026-04-01", stcompra: "conc", status: 3, voucher_count: "1", unused_voucher_count: "1" }] };
      if (sql.includes("voucher.descricao AS descricao")) return { rows: [{ idcompra: 77, idvoucher: 11, stusado: "n", stvoucher: "ativo", tpvoucher: "norma", dtagenda: "2026-04-20", tpagenda: "padra", dtinicio_validade: start, dtvalidade: end, parque_operacional: start ? "rincao" : null, delivery_hold: held }] };
      return { rows: [], rowCount: 0 };
    });
    const page = await getUserVouchersPage("52998224725", 10, 0);
    expect(page.purchases[0].vouchers[0]).toMatchObject({ validFrom: start, validUntil: start ? end : "2026-10-01", expiredForGeneration: expired, canReschedule: reschedule, deliveryHold: held, canSelectForVoucher: !expired && !held });
    expect(page.purchases[0]).toMatchObject({ status: "conc", canGenerateVoucher: !expired && !held });
  });
});


describe("voucher persistence policy boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks(); resetVoucherLifecycleSchemaForTests();
    dbQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-04-27T01:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());
  it("uses the Sao Paulo civil date and exact snapshot end in expiration", async () => {
    await expireUnusedVouchers();
    expect(dbQuery).toHaveBeenCalledWith(expect.stringContaining("voucher.dtinicio_validade IS NOT NULL"), ["2026-04-26"]);
    const expirationSql = dbQuery.mock.calls.find(([sql]) => String(sql).includes("UPDATE voucher"))?.[0];
    expect(expirationSql).toContain("voucher.dtinicio_validade IS NULL");
  });
  it("guards direct rescheduling in the database mutation", async () => {
    await rescheduleUserVoucher("52998224725", 11, 22);
    expect(dbQuery).toHaveBeenCalledWith(expect.stringContaining("AND voucher.dtinicio_validade IS NULL"), [22, 11, "52998224725"]);
  });
});
