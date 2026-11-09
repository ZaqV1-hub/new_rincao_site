import type { OpsClientTripSchoolReport } from "@/lib/ops-client-trip-school-report";
import { describe, expect, it } from "vitest";

const report: OpsClientTripSchoolReport = {
  trip: {
    agendaId: 10,
    clientId: 20,
    clientName: "Colegio Rincao",
    clientTypeName: "Escola",
    date: "2026-06-15",
    dateLabel: "15/06/2026",
    code: "ABC123",
    slug: "abc123slug",
    agendaType: "escol",
    agendaTypeLabel: "Escolar",
    agendaStatus: "abe",
    agendaStatusLabel: "Aberta",
  },
  filters: {
    purchaseStatus: "conc",
  },
  statusOptions: [],
  indicators: {
    paidCount: 1,
    unpaidCount: 0,
    usedCount: 0,
    unusedCount: 1,
    paidValue: "49.90",
    unpaidValue: "0.00",
    usedValue: "0.00",
    unusedValue: "49.90",
    totalCount: 1,
    totalValue: "49.90",
  },
  students: [
    {
      purchaseId: 901,
      voucherId: 1001,
      voucherNumber: "VCH-1",
      name: "Ana Souza",
      role: "",
      educationType: "fund1",
      educationYear: "3",
      classLetter: "B",
      classDisplay: "Ensino Fundamental I - 3o ano - B",
      unitValue: "49.90",
      purchaseDate: "2026-05-10",
      purchaseDateLabel: "10/05/2026 10:15",
      paymentDate: "2026-05-10",
      paymentDateLabel: "10/05/2026 10:17",
      used: false,
      usedLabel: "Nao",
      usedDate: null,
      usedDateLabel: "-",
      purchaseStatus: "conc",
      purchaseStatusLabel: "Concluida",
    },
  ],
  educators: [],
};

describe("ops-client-trip-school-report-pdf", () => {
  it.each(["school", "internal"] as const)("mantém 23 alunos da turma em uma página no PDF %s", async (audience) => {
    const { renderOpsClientTripSchoolReportPdfBuffer } = await import(
      "@/lib/ops-client-trip-school-report-pdf"
    );

    const students = Array.from({ length: 23 }, (_, index) => ({
      ...report.students[0],
      purchaseId: 900000040 + index,
      voucherId: 1001 + index,
      name: "Helena Rosa dos Santos de Jesus Camargo de Andrade",
      voucherNumber: `ESC-${String(index).padStart(4, "0")}`,
    }));
    const buffer = await renderOpsClientTripSchoolReportPdfBuffer({ ...report, students }, audience);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.byteLength).toBeGreaterThan(100);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(buffer.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(2);
  }, 45_000);
});
