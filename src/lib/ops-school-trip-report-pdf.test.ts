import { describe, expect, it } from "vitest";

describe("ops-school-trip-report-pdf", () => {
  it("renders a pdf buffer for a school trip report", async () => {
    const { renderOpsSchoolTripReportPdfBuffer } = await import(
      "@/lib/ops-school-trip-report-pdf"
    );

    const buffer = await renderOpsSchoolTripReportPdfBuffer({
      trip: {
        agendaId: 10,
        schoolId: 20,
        schoolName: "Colegio Rincao",
        date: "2026-06-15",
        dateLabel: "15/06/2026",
        code: "ABC123",
        permalink: "abc123slug",
        agendaType: "escol",
        agendaTypeLabel: "Escolar",
        agendaStatus: "abe",
        agendaStatusLabel: "Aberta",
        schoolStatus: "ati",
        schoolStatusLabel: "Ativa",
        tripStatus: "ati",
        tripStatusLabel: "Ativa",
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
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.byteLength).toBeGreaterThan(100);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});
