import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listPainelCompraConvenio,
  normalizePainelCompraConvenioFilters,
  renderPainelCompraConvenioExportTable,
} from "@/lib/painel-compra-convenio";

const mocks = vi.hoisted(() => ({
  getAgreementPurchaseReport: vi.fn(),
  query: vi.fn(),
}));

vi.mock("@/lib/ops-agreement-purchases", () => ({
  asOpsAgreementPurchaseReportError: (error: unknown) => error,
  getAgreementPurchaseReport: mocks.getAgreementPurchaseReport,
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    query: mocks.query,
  }),
}));

describe("normalizePainelCompraConvenioFilters", () => {
  it("normaliza os filtros legados da sidebar", () => {
    expect(
      normalizePainelCompraConvenioFilters({
        convenio: "Convenio Alfa",
        numvoucher: "ABC123",
        "dtcompra[de]": "01/05/2026",
        "dtcompra[ate]": "31/05/2026",
        stusado: "n",
      }),
    ).toMatchObject({
      agreementName: "Convenio Alfa",
      voucherNumber: "ABC123",
      visitDateFrom: "01/05/2026",
      visitDateTo: "31/05/2026",
      usedStatus: "n",
    });
  });
});

describe("listPainelCompraConvenio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carrega indicadores, linhas agrupadas e opcoes de convenio", async () => {
    mocks.getAgreementPurchaseReport.mockResolvedValue({
      filters: {
        agreementName: "Convenio Alfa",
      },
      indicators: {
        qtdnormal: 5,
        vlnormal: "250.00",
        qtdinfantil: 2,
        vlinfantil: "60.00",
        qtdisento: 1,
        qtdescola: 3,
        vlescola: "45.00",
        qtdconvenio: 11,
        vlconvenio: "355.00",
      },
      rows: [
        {
          agreementName: "Convenio Alfa",
          adultQuantity: 5,
          adultValue: "250.00",
          childQuantity: 2,
          childValue: "60.00",
          schoolQuantity: 3,
          schoolValue: "45.00",
          exemptQuantity: 1,
          totalQuantity: 11,
          totalValue: "355.00",
        },
      ],
    });
    mocks.query.mockResolvedValue({
      rows: [{ nmconvenio: "Convenio Alfa" }, { nmconvenio: "Convenio Beta" }],
    });

    await expect(
      listPainelCompraConvenio({ convenio: "Convenio Alfa" }),
    ).resolves.toMatchObject({
      filters: {
        agreementName: "Convenio Alfa",
      },
      indicators: {
        totalCount: 11,
        totalValue: "355,00",
      },
      agreementOptions: [{ name: "Convenio Alfa" }, { name: "Convenio Beta" }],
    });
  });
});

describe("renderPainelCompraConvenioExportTable", () => {
  it("gera html excel-like com o cabeçalho legado", () => {
    const html = renderPainelCompraConvenioExportTable([
      {
        Convenios: "Convenio Alfa",
        Passaporte: "5",
        ValorPassaporte: "250,00",
        Infantil: "2",
        ValorInfantil: "60,00",
        Escolar: "3",
        ValorEscolar: "45,00",
        Isento: "1",
        TotalIngressos: "11",
        TotalValores: "355,00",
      },
    ]);

    expect(html).toContain("<th>Convenios</th>");
    expect(html).toContain("Convenio Alfa");
  });
});
