import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BuyRoutePage from "./page";
import { OperationalDayOfferError } from "@/lib/operational-day-offer";

const mock = vi.hoisted(() => ({ offer: vi.fn(), agenda: vi.fn(), publicAgenda: vi.fn(), expired: vi.fn(), user: { cpf: "11111111111", name: "Cliente", cpfMasked: "***", email: null } }));
vi.mock("@/lib/customer-area", () => ({ requireAuthenticatedCustomer: async () => mock.user }));
vi.mock("@/lib/agenda-id", () => ({ parseAgendaId: () => 12 }));
vi.mock("@/lib/agenda-repository", () => ({ getPublicAgendaEventById: mock.publicAgenda, isAgendaDateExpired: mock.expired }));
vi.mock("@/lib/purchase-repository", () => ({ getPurchaseAgendaContext: mock.agenda }));
vi.mock("@/lib/operational-day-offer", async (original) => ({ ...await original<typeof import("@/lib/operational-day-offer")>(), loadOperationalDayOffer: mock.offer }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not-found"); } }));
vi.mock("@/components/purchase-page", () => ({ PurchasePage: () => null }));
vi.mock("@/components/ingresso-shell", () => ({ IngressoShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

describe("purchase page operational offer", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mock.expired.mockReturnValue(false); mock.publicAgenda.mockResolvedValue(null);
    mock.agenda.mockResolvedValue({ id: 12, date: "2099-01-31", priceTable: { id: 7, normal: "110.00", child: "80.00" } });
  });
  it("passes the actual offer and sold interval to the customer component", async () => {
    const offer = { products: [{ id: "servico:17" }], validity: { validFrom: "2099-01-31", validUntil: "2099-02-06" } };
    mock.offer.mockResolvedValue(offer);
    const page = await BuyRoutePage({ params: Promise.resolve({ id: "12" }) });
    expect(page.props).toMatchObject({ ...offer, user: mock.user });
    expect(mock.offer).toHaveBeenCalledWith(expect.objectContaining({ id: 12 }));
  });
  it("does not show a stale offer when its managed configuration closed or diverged", async () => {
    mock.offer.mockRejectedValue(new OperationalDayOfferError());
    await expect(BuyRoutePage({ params: Promise.resolve({ id: "12" }) })).rejects.toThrow("not-found");
  });
});
