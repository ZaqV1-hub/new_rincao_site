import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOpsSchoolTripReport } from "@/lib/ops-school-trip-report";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    query: mocks.query,
  }),
}));

describe("ops-school-trip-report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads school trip participants, indicators and status options", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM escoladata") && sql.includes("JOIN escola")) {
        return {
          rowCount: 1,
          rows: [
            {
              idagenda: 77,
              dtagenda: "2026-06-15",
              dtagenda_fmt: "15/06/2026",
              tpagenda: "escol",
              stagenda: "abe",
              idescola: 44,
              nmescola: "Colegio Estancia",
              stescola: "ati",
              status: "ati",
              codescoladata: "ABC123",
              permalink: "abc123slug",
            },
          ],
        };
      }

      if (sql.includes("SELECT DISTINCT compra.stcompra AS status")) {
        return {
          rows: [{ status: "conc" }, { status: "pend" }],
        };
      }

      if (sql.includes("FROM voucher") && sql.includes("LEFT JOIN pagpagseguro")) {
        return {
          rows: [
            {
              idcompra: 901,
              idvoucher: 1001,
              numvoucher: "VCH-1",
              tpparticipante: "aluno",
              nomealuno: "Ana Souza",
              nomeeducador: null,
              funcaoeducador: null,
              ensino_tipo: "fund1",
              ensino_ano: "3",
              turma_letra: "B",
              turma: null,
              vlunicompra: "49.90",
              dtcompra: "2026-05-10",
              hrcompra: "10:15:00",
              dtpagamento: "2026-05-10",
              hrpagamento: "10:17:00",
              stcompra: "conc",
              dtuso: null,
              hruso: null,
              stusado: "n",
            },
            {
              idcompra: 901,
              idvoucher: 1002,
              numvoucher: "VCH-2",
              tpparticipante: "educador",
              nomealuno: null,
              nomeeducador: "Carlos Lima",
              funcaoeducador: "Professor",
              ensino_tipo: null,
              ensino_ano: null,
              turma_letra: null,
              turma: null,
              vlunicompra: "0.00",
              dtcompra: "2026-05-10",
              hrcompra: "10:15:00",
              dtpagamento: null,
              hrpagamento: null,
              stcompra: "pend",
              dtuso: "2026-06-15",
              hruso: "08:40:00",
              stusado: "s",
            },
          ],
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    await expect(
      getOpsSchoolTripReport({
        agendaId: 77,
        schoolId: 44,
      }),
    ).resolves.toMatchObject({
      trip: {
        agendaId: 77,
        schoolId: 44,
        schoolName: "Colegio Estancia",
        code: "ABC123",
      },
      filters: {
        purchaseStatus: "",
      },
      statusOptions: [
        { value: "", label: "Todos" },
        { value: "conc", label: "Concluida" },
        { value: "pend", label: "Pendente" },
      ],
      indicators: {
        paidCount: 1,
        unpaidCount: 1,
        usedCount: 1,
        unusedCount: 1,
        totalValue: "49.90",
      },
      students: [
        expect.objectContaining({
          purchaseId: 901,
          voucherNumber: "VCH-1",
          name: "Ana Souza",
          classDisplay: "Ensino Fundamental I - 3o ano - B",
          purchaseStatus: "conc",
        }),
      ],
      educators: [
        expect.objectContaining({
          purchaseId: 901,
          voucherNumber: "VCH-2",
          name: "Carlos Lima",
          role: "Professor",
          purchaseStatus: "pend",
          used: true,
        }),
      ],
    });
  });

  it("rejects missing school trip binding", async () => {
    mocks.query.mockResolvedValue({
      rowCount: 0,
      rows: [],
    });

    await expect(
      getOpsSchoolTripReport({
        agendaId: 77,
        schoolId: 44,
      }),
    ).rejects.toMatchObject({
      code: "school_trip_report_not_found",
      status: 404,
    });
  });
});
