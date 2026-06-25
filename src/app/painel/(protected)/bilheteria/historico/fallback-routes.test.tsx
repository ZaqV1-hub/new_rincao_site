import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn();
const requirePainelBilheteriaHistorySession = vi.fn();
const loadPainelBilheteriaPurchaseDetailFromParams = vi.fn();
const readPainelBilheteriaFlashState = vi.fn();

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("@/lib/painel-bilheteria-page", () => ({
  requirePainelBilheteriaHistorySession,
  loadPainelBilheteriaPurchaseDetailFromParams,
  readPainelBilheteriaFlashState,
}));

describe("painel bilheteria history fallback routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePainelBilheteriaHistorySession.mockResolvedValue({
      actorName: "Gestor Teste",
      actorCpf: "52998224725",
    });
    readPainelBilheteriaFlashState.mockReturnValue({
      flashSuccess: null,
      flashWarnings: [],
    });
  });

  it("redirects dedicated detail routes back into the history overlay query state", async () => {
    loadPainelBilheteriaPurchaseDetailFromParams.mockResolvedValue({
      purchaseId: 171387,
      detail: {
        purchaseId: 171387,
        status: "conc",
      },
    });
    readPainelBilheteriaFlashState.mockReturnValue({
      flashSuccess: "Compra salva",
      flashWarnings: ["Revisar"],
    });

    const page =
      (await import("@/app/painel/(protected)/bilheteria/historico/[purchaseId]/page"))
        .default;
    await page({
      params: Promise.resolve({
        purchaseId: "171387",
      }),
      searchParams: Promise.resolve({
        success: "Compra salva",
        warning: "Revisar",
      }),
    });

    expect(redirect).toHaveBeenCalledWith(
      "/painel/bilheteria/historico?purchase=171387&success=Compra+salva&warning=Revisar",
    );
  });

  it("redirects dedicated edit routes back into history edit mode when the purchase is editable", async () => {
    loadPainelBilheteriaPurchaseDetailFromParams.mockResolvedValue({
      purchaseId: 171387,
      detail: {
        purchaseId: 171387,
        status: "conc",
      },
    });

    const page =
      (
        await import(
          "@/app/painel/(protected)/bilheteria/historico/[purchaseId]/editar/page"
        )
      ).default;
    await page({
      params: Promise.resolve({
        purchaseId: "171387",
      }),
    });

    expect(redirect).toHaveBeenCalledWith(
      "/painel/bilheteria/historico?purchase=171387&mode=edit",
    );
  });
});
