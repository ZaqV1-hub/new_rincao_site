import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPainelCortesia, listPainelCortesias } from "@/lib/painel-cortesias";

const mocks = vi.hoisted(() => ({
  getOperationalReferenceData: vi.fn(),
  createOperationalCourtesyAuthor: vi.fn(),
  updateOperationalCourtesyAuthor: vi.fn(),
  deleteOperationalCourtesyAuthor: vi.fn(),
}));

vi.mock("@/lib/ops-reference-data", () => ({
  getOperationalReferenceData: mocks.getOperationalReferenceData,
  createOperationalCourtesyAuthor: mocks.createOperationalCourtesyAuthor,
  updateOperationalCourtesyAuthor: mocks.updateOperationalCourtesyAuthor,
  deleteOperationalCourtesyAuthor: mocks.deleteOperationalCourtesyAuthor,
}));

describe("painel-cortesias", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOperationalReferenceData.mockResolvedValue({
      discountTypes: [],
      discounts: [],
      courtesyAuthors: [{ id: 10, name: "Diretoria" }],
    });
  });

  it("lista autorizadores paginados", async () => {
    await expect(listPainelCortesias({ page: "1" })).resolves.toMatchObject({
      total: 1,
      items: [{ id: 10, name: "Diretoria" }],
    });
  });

  it("carrega autorizador individual", async () => {
    await expect(getPainelCortesia("10")).resolves.toMatchObject({
      id: 10,
      name: "Diretoria",
    });
  });
});
