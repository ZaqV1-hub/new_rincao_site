import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePainelAccess = vi.fn();
const lookupPainelBilheteriaTicketByVoucherId = vi.fn();
const getBilheteriaAgendaStatusToday = vi.fn();
const workstationProps = vi.fn();

vi.mock("@/lib/painel-session", () => ({
  requirePainelAccess,
}));

vi.mock("@/lib/painel-bilheteria-workstation", () => ({
  lookupPainelBilheteriaTicketByVoucherId,
}));

vi.mock("@/lib/bilheteria-agenda", () => ({
  getBilheteriaAgendaStatusToday,
}));

vi.mock("@/components/painel-bilheteria-page-header", () => ({
  PainelBilheteriaPageHeader: (props: Record<string, unknown>) =>
    React.createElement("div", {
      "data-testid": "page-header",
      "data-title": String(props.title ?? ""),
    }),
}));

vi.mock("@/components/painel-bilheteria-workstation", () => ({
  PainelBilheteriaWorkstation: (props: Record<string, unknown>) => {
    workstationProps(props);
    return React.createElement("div", { "data-testid": "workstation" });
  },
}));

describe("/painel/bilheteria overview route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBilheteriaAgendaStatusToday.mockResolvedValue({
      today: "2026-06-29",
      hasOpenAgendaToday: true,
      openAgendas: [{ date: "2026-06-29", status: "abe" }],
    });
    requirePainelAccess.mockResolvedValue({
      actorName: "Operador Teste",
      actorCpf: "52998224725",
      legacyRoleId: 1,
    });
  });

  it("hydrates the ticket lookup modal from the overview query instead of the history route", async () => {
    lookupPainelBilheteriaTicketByVoucherId.mockResolvedValue({
      lookup: "123",
      voucherId: 123,
      purchaseId: 45,
      purchaseDate: "2026-05-05",
      usedDate: null,
      used: false,
    });

    const page = (await import("@/app/painel/(protected)/bilheteria/page")).default;
    const element = await page({
      searchParams: Promise.resolve({
        ingresso: "123",
      }),
    });

    renderToStaticMarkup(React.createElement(React.Fragment, null, element));

    expect(requirePainelAccess).toHaveBeenCalledWith(
      "vis_bilhet",
      "/painel/bilheteria",
    );
    expect(lookupPainelBilheteriaTicketByVoucherId).toHaveBeenCalledWith("123");
    expect(workstationProps).toHaveBeenCalledWith(
      expect.objectContaining({
        initialTicketLookupState: expect.objectContaining({
          isOpen: true,
          lookup: "123",
          result: expect.objectContaining({
            voucherId: 123,
            purchaseId: 45,
          }),
        }),
      }),
    );
  });

  it("mantem a bilheteria aberta quando a agenda do dia estiver lotada", async () => {
    getBilheteriaAgendaStatusToday.mockResolvedValue({
      today: "2026-06-29",
      hasOpenAgendaToday: true,
      openAgendas: [{ date: "2026-06-29", status: "lot" }],
    });

    const page = (await import("@/app/painel/(protected)/bilheteria/page")).default;
    const element = await page({
      searchParams: Promise.resolve({}),
    });

    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, element));

    expect(html).toContain("data-testid=\"workstation\"");
  });
});
