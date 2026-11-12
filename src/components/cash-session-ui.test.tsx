import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { CashSessionSnapshotView } from "./cash-session-snapshot-view";
import { PainelCashSessionsPage, availableCashLocations } from "./painel-cash-sessions-page";
import { PainelCashSessionPage } from "./painel-cash-session-page";
import type { CashSessionDetail, CashSessionSnapshot } from "@/lib/operational-cash-session";
import type { CashLocation } from "@/lib/operational-day-contract";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./painel-bilheteria-workstation", () => ({ PainelBilheteriaWorkstation: ({ periodId }: { periodId: number | null }) => <p>Validação: {periodId ?? "somente consulta"}</p> }));
const snapshot: CashSessionSnapshot = {
  schemaVersion: 1, periodId: 1, park: "rincao", date: "2026-11-12", locationId: 1, locationName: "Portaria", type: "sales",
  generatedAt: "2026-11-12T12:00:00Z", closedAt: null, openingCashCents: 10000,
  payments: [{ method: "dinhe", amountCents: 8000 }], receiptsCount: 1, lastReceiptAt: "2026-11-12T11:00:00Z",
  cashReceivedCents: 8000, fundsCents: 2000, withdrawalsCents: 5000, expensesCents: 0, refundsCents: 0,
  expectedCashCents: 15000, countedCashCents: null, differenceCents: null,
  sales: { purchaseCount: 1, ticketCount: 1, serviceCount: 1, courtesyCount: 0, revenueCents: 8000, serviceRevenueCents: 1000, discountCents: 0 },
  admissions: { ticketCount: 3, serviceCount: 1, onlineTicketCount: 2, schoolCount: 0, unclassifiedCount: 0 },
  services: [{ serviceId: 1, name: "Armário", quantity: 1, revenueCents: 1000 }], movements: [], pending: ["cash_count_missing"],
};
const session: CashSessionDetail = { id: 1, park: "rincao", date: snapshot.date, locationId: 1, locationName: "Portaria", type: "sales", openingCashCents: 10000,
  openedAt: "2026-11-12T10:00:00Z", closedAt: null, openedBy: { name: "Operador", cpf: null }, closedBy: null, closureId: null, countedCashCents: null, automatic: false, snapshot };
const location: CashLocation = { id: 1, version: 1, name: "Portaria", description: "", active: true };
it("distinguishes missing cash count from an explicit zero and excludes services from ticket average", () => {
  const html = renderToStaticMarkup(<CashSessionSnapshotView snapshot={snapshot} />);
  expect(html).toContain("Não informado"); expect(html).toContain("Aguardando conferência"); expect(html).toContain("70,00");
  const counted = renderToStaticMarkup(<CashSessionSnapshotView snapshot={{ ...snapshot, countedCashCents: 0, differenceCents: -15000, pending: [] }} />);
  expect(counted).not.toContain("Não informado"); expect(counted).toMatch(/Contado<\/dt><dd[^>]*>R\$\s*0,00/); expect(counted).toContain("150,00");
});
it("offers only active locations without an open session and allows a new session after close", () => {
  const inactive = { ...location, id: 2, active: false };
  expect(availableCashLocations([location, inactive], [session])).toEqual([]);
  expect(availableCashLocations([location, inactive], [{ ...session, closedAt: "2026-11-12T12:00:00Z" }])).toEqual([location]);
  const html = renderToStaticMarkup(<PainelCashSessionsPage date="2026-11-11" today={snapshot.date} sessions={[]} locations={[location]} />);
  expect(html).toContain("só podem ser abertos na data de hoje"); expect(html).not.toContain("Troco inicial");
});
it("keeps closed sessions on their frozen report and never mounts new sales", () => {
  const html = renderToStaticMarkup(<PainelCashSessionPage initial={{ ...session, closedAt: "2026-11-12T12:00:00Z" }} today={snapshot.date} sale={<p>Nova venda</p>} operator={{ name: "Operador", cpf: null, isManager: false }} />);
  expect(html).toContain("Fechamento registrado"); expect(html).toContain("/painel/caixas/1/imprimir"); expect(html).not.toContain("Nova venda");
});
it("restores reservation return links into the consultation tab with the explicit cashier", () => {
  const html = renderToStaticMarkup(<PainelCashSessionPage initial={session} today={snapshot.date} initialTab="reservas" sale={<p>Nova venda</p>} operator={{ name: "Operador", cpf: null, isManager: false }} />);
  expect(html).toContain("Validação: 1"); expect(html).not.toContain("Nova venda");
});
