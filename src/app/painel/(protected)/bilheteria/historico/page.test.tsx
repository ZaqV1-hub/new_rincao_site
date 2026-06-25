import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn();
const requirePainelAccess = vi.fn();
const listPainelBilheteriaHistory = vi.fn();
const getPainelBilheteriaPurchaseDetail = vi.fn();
const getPainelBilheteriaPaymentOptions = vi.fn();
const readPainelBilheteriaFlashState = vi.fn();

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("@/lib/painel-session", () => ({
  requirePainelAccess,
}));

vi.mock("@/lib/painel-bilheteria", () => ({
  listPainelBilheteriaHistory,
  getPainelBilheteriaPurchaseDetail,
  getPainelBilheteriaPaymentOptions,
}));

vi.mock("@/lib/painel-bilheteria-page", () => ({
  readPainelBilheteriaFlashState,
}));

vi.mock("@/components/painel-bilheteria-page-header", () => ({
  PainelBilheteriaPageHeader: () => React.createElement("div", { "data-testid": "header" }),
}));

vi.mock("@/components/painel-bilheteria-purchase-detail", () => ({
  PainelBilheteriaPurchaseDetail: (props: Record<string, unknown>) =>
    React.createElement("div", {
      "data-testid": "purchase-detail",
      "data-purchase-id": String((props.detail as { purchaseId: number }).purchaseId),
    }),
}));

vi.mock("@/components/painel-bilheteria-history-editor", () => ({
  PainelBilheteriaHistoryEditor: (props: Record<string, unknown>) =>
    React.createElement("div", {
      "data-testid": "history-editor",
      "data-purchase-id": String((props.detail as { purchaseId: number }).purchaseId),
    }),
}));

describe("/painel/bilheteria/historico page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePainelAccess.mockResolvedValue({
      actorName: "Gestor Teste",
      actorCpf: "52998224725",
      legacyRoleId: 1,
    });
    listPainelBilheteriaHistory.mockResolvedValue({
      items: [
        {
          purchaseId: 171387,
          purchaseDate: "2026-05-05",
          cpf: "52998224725",
          totalValue: "R$ 10,00",
          paymentLabels: ["Pix"],
          status: "conc",
          statusLabel: "Concluida",
        },
      ],
      page: 1,
      pageSize: 30,
      total: 1,
      totalPages: 1,
      filters: {
        purchaseId: "",
        cpf: "",
        value: "",
        dateFrom: "",
        dateTo: "",
        type: null,
      },
    });
    getPainelBilheteriaPurchaseDetail.mockResolvedValue({
      purchaseId: 171387,
      status: "conc",
      vouchers: [],
      payments: [],
      discountOptions: [],
      totalValue: "R$ 10,00",
      paymentMethod: "pix",
    });
    getPainelBilheteriaPaymentOptions.mockReturnValue([]);
    readPainelBilheteriaFlashState.mockReturnValue({
      flashSuccess: null,
      flashWarnings: [],
    });
  });

  it("renders selected detail inside a same-context modal overlay instead of an inline block", async () => {
    const page =
      (await import("@/app/painel/(protected)/bilheteria/historico/page")).default;
    const element = await page({
      searchParams: Promise.resolve({
        purchase: "171387",
      }),
    });
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, element));

    expect(html).toContain("Detalhe da compra #171387");
    expect(html).toContain("Fechar modal");
    expect(html).not.toContain("Contexto inline");
  });
});
