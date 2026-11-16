import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DayCashBadge, DayCashPanel } from "./painel-operational-day-page-cash";
import type { CashSession } from "@/lib/operational-cash-session";
const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("./counting-controls", () => ({ useCountingRead: mocks.read, countTime: () => "10:00" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./cash-session-command-form", () => ({ CashSessionCommandForm: () => null }));
const session = (id = 1): CashSession => ({ id, park: "rincao", date: "2026-11-17", locationId: id, locationName: `Local ${id}`, type: "sales", openingCashCents: 10000, openedAt: "2026-11-17T10:00:00Z", closedAt: null, openedBy: { name: "Operadora", cpf: "22181922845" }, closedBy: null, closureId: null, countedCashCents: null, automatic: false });
beforeEach(() => { mocks.read.mockReset(); });
describe("embedded day cash", () => {
  it("counts only open sessions in the header", () => {
    mocks.read.mockReturnValue({ data: [session(), { ...session(2), closedAt: "2026-11-17T15:00:00Z" }], error: "" });
    expect(renderToStaticMarkup(<DayCashBadge date="2026-11-17" />)).toContain("1 caixa(s) aberto(s)");
  });
  it("shows canonical metrics and routes the trip cash to its tab", () => {
    mocks.read.mockImplementation((url: string) => ({ error: "", checkedAt: "2026-11-17T12:00:00Z", data: url.includes("?date") ? [session(), { ...session(2), type: "trips" }] : { snapshot: { payments: [{ amountCents: 20000 }], expectedCashCents: 12000, receiptsCount: 2, expensesCents: 500, sales: { revenueCents: 10000, ticketCount: 8 }, admissions: { ticketCount: 3 } } } }));
    const html = renderToStaticMarkup(<DayCashPanel date="2026-11-17" closed />);
    for (const text of ["Público vendido", "Ingressos lidos", "100,00", "120,00", "Recebido das escolas", "200,00", "Despesas em dinheiro"]) expect(html).toContain(text);
    expect(html).toContain('href="/painel/agenda/2026-11-17?tab=passeios"');
    expect(html).toContain("Dia finalizado: caixas somente para consulta.");
    expect(html).not.toContain(">Abrir caixa</button>");
  });
  it("bounds detail requests to six visible cards and preserves unavailable values", () => {
    mocks.read.mockImplementation((url: string) => ({ error: url.includes("?date") ? "" : "Sessão expirada", data: url.includes("?date") ? Array.from({ length: 10 }, (_, i) => session(i + 1)) : null }));
    const html = renderToStaticMarkup(<DayCashPanel date="2026-11-17" closed />);
    expect(mocks.read).toHaveBeenCalledTimes(7);
    expect(html).toContain("1 de 2"); expect(html).toContain("Valores indisponíveis");
    expect(html).not.toContain("R$ 0,00");
  });
});
