import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPainelDiscount,
  listPainelDiscounts,
  listPainelDiscountTypes,
} from "@/lib/painel-descontos";

const mocks = vi.hoisted(() => ({
  getOperationalReferenceData: vi.fn(),
  createOperationalDiscount: vi.fn(),
  updateOperationalDiscount: vi.fn(),
  deleteOperationalDiscount: vi.fn(),
  createOperationalDiscountType: vi.fn(),
  updateOperationalDiscountType: vi.fn(),
  deleteOperationalDiscountType: vi.fn(),
}));

vi.mock("@/lib/ops-reference-data", () => ({
  getOperationalReferenceData: mocks.getOperationalReferenceData,
  createOperationalDiscount: mocks.createOperationalDiscount,
  updateOperationalDiscount: mocks.updateOperationalDiscount,
  deleteOperationalDiscount: mocks.deleteOperationalDiscount,
  createOperationalDiscountType: mocks.createOperationalDiscountType,
  updateOperationalDiscountType: mocks.updateOperationalDiscountType,
  deleteOperationalDiscountType: mocks.deleteOperationalDiscountType,
}));

describe("painel-descontos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOperationalReferenceData.mockResolvedValue({
      discountTypes: [{ id: 1, description: "Professor" }],
      discounts: [
        {
          id: 10,
          typeId: 1,
          typeDescription: "Professor",
          name: "Desconto Professor",
          applicationType: "percentual",
          value: "10.00",
        },
      ],
      courtesyAuthors: [],
    });
  });

  it("lista descontos paginados", async () => {
    await expect(listPainelDiscounts({ page: "1" })).resolves.toMatchObject({
      total: 1,
      items: [
        {
          id: 10,
          applicationTypeLabel: "Percentual",
          valueLabel: "10,00",
        },
      ],
    });
  });

  it("lista categorias paginadas", async () => {
    await expect(listPainelDiscountTypes({ page: "1" })).resolves.toMatchObject({
      total: 1,
      items: [{ id: 1, description: "Professor" }],
    });
  });

  it("carrega desconto individual", async () => {
    await expect(getPainelDiscount("10")).resolves.toMatchObject({
      id: 10,
      name: "Desconto Professor",
    });
  });
});
