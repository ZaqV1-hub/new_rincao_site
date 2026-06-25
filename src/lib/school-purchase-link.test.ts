import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveSchoolPurchasePreset = vi.fn();

vi.mock("@/lib/school-purchase-repository", () => ({
  resolveSchoolPurchasePreset,
}));

describe("school-purchase-link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves a school preset from a valid exclusive plink", async () => {
    resolveSchoolPurchasePreset.mockResolvedValue({
      schoolId: 20,
      schoolName: "Colegio Estancia",
      agendaId: 10,
      agendaLabel: "15/06/2026",
    });

    const { createClientTripPlink } = await import("@/lib/plink");
    const { resolveSchoolPurchasePresetFromPlink } = await import(
      "@/lib/school-purchase-link"
    );
    const token = createClientTripPlink({
      idagenda: 10,
      idcliente: 20,
      tipo: "escola",
    });

    await expect(resolveSchoolPurchasePresetFromPlink(token)).resolves.toEqual({
      schoolId: 20,
      schoolName: "Colegio Estancia",
      agendaId: 10,
      agendaLabel: "15/06/2026",
    });
    expect(resolveSchoolPurchasePreset).toHaveBeenCalledWith(20, 10);
  });

  it("rejects non-school plinks before hitting the repository", async () => {
    const { createClientTripPlink } = await import("@/lib/plink");
    const { resolveSchoolPurchasePresetFromPlink } = await import(
      "@/lib/school-purchase-link"
    );
    const token = createClientTripPlink({
      idagenda: 10,
      idcliente: 20,
      tipo: "igreja",
    });

    await expect(resolveSchoolPurchasePresetFromPlink(token)).resolves.toBeNull();
    expect(resolveSchoolPurchasePreset).not.toHaveBeenCalled();
  });
});
