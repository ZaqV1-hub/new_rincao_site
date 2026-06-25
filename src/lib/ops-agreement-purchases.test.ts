import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAgreementPurchaseReport } from "@/lib/ops-agreement-purchases";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    query: mocks.query,
  }),
}));

describe("ops-agreement-purchases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads indicators and grouped rows for the agreement purchase report", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT\n        COALESCE(SUM(CASE WHEN tpvoucher = 'norma'")) {
        return {
          rows: [
            {
              qtdnormal: "5",
              vlnormal: "250.00",
              qtdinfantil: "2",
              vlinfantil: "60.00",
              qtdisento: "1",
              qtdescola: "3",
              vlescola: "45.00",
              qtdconvenio: "11",
              vlconvenio: "355.00",
            },
          ],
        };
      }

      return {
        rows: [
          {
            agreement_name: "Convenio Alfa",
            adult_quantity: "5",
            adult_value: "250.00",
            child_quantity: "2",
            child_value: "60.00",
            school_quantity: "3",
            school_value: "45.00",
            exempt_quantity: "1",
            total_quantity: "11",
            total_value: "355.00",
          },
        ],
      };
    });

    await expect(
      getAgreementPurchaseReport({
        agreementName: "Convenio Alfa",
        visitDateFrom: "2026-04-01",
        visitDateTo: "2026-04-30",
      }),
    ).resolves.toMatchObject({
      filters: {
        agreementName: "Convenio Alfa",
        visitDateFrom: "2026-04-01",
        visitDateTo: "2026-04-30",
      },
      indicators: {
        qtdnormal: 5,
        vlnormal: "250.00",
        qtdconvenio: 11,
        vlconvenio: "355.00",
      },
      rows: [
        {
          agreementName: "Convenio Alfa",
          adultQuantity: 5,
          totalQuantity: 11,
          totalValue: "355.00",
        },
      ],
    });
  });

  it("rejects invalid date filters", async () => {
    await expect(
      getAgreementPurchaseReport({
        visitDateFrom: "31/02/2026",
      }),
    ).rejects.toMatchObject({
      code: "invalid_agreement_purchase_filter",
      status: 400,
    });
  });

  it("ignores null and blank filters from painel forms", async () => {
    mocks.query.mockResolvedValue({ rows: [] });

    await expect(
      getAgreementPurchaseReport({
        visitDateFrom: null,
        visitDateTo: "",
        usedDateFrom: undefined,
        usedDateTo: "   ",
        paymentStatus: null,
        paymentMethodType: "",
        usedStatus: "",
      }),
    ).resolves.toMatchObject({
      filters: {
        visitDateFrom: null,
        visitDateTo: null,
        usedDateFrom: null,
        usedDateTo: null,
        paymentStatus: null,
        paymentMethodType: null,
        usedStatus: null,
      },
      rows: [],
    });

    expect(mocks.query).toHaveBeenCalledTimes(2);
  });
});
