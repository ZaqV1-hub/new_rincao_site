import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBilheteriaAgendaStatusToday } from "@/lib/bilheteria-agenda";

const getPainelAgendaDay = vi.hoisted(() => vi.fn());

vi.mock("@/lib/painel-agenda", () => ({
  getPainelAgendaDay,
}));

describe("getBilheteriaAgendaStatusToday", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["abe", "lot", "fec"])("uses box office prices independently of online agenda status %s", async (status) => {
    getPainelAgendaDay.mockResolvedValue({
      selectedDate: "2026-07-01",
      agenda: {
        id: 2335,
        date: "2026-07-01",
        day: 1,
        month: 7,
        year: 2026,
        type: "padra",
        status,
        priceTableId: 13,
        priceTableName: "ASSOCIADO - TESTE",
        normalValue: "20.00",
        childValue: "10.00",
        gateNormalValue: "50.00",
        gateChildValue: "30.00",
        informationId: null,
        informationName: null,
        promotionName: null,
        promotionDescription: null,
      },
      vouchers: [],
    });

    await expect(getBilheteriaAgendaStatusToday()).resolves.toMatchObject({
      hasOpenAgendaToday: true,
      openAgendas: [
        {
          id: 2335,
          priceTable: {
            normal: "20.00",
            child: "10.00",
            gateNormal: "50.00",
            gateChild: "30.00",
          },
        },
      ],
    });
  });
  it.each([null, { status: "canc" }])("does not enable sales without a valid agenda: %j", async (agenda) => {
    getPainelAgendaDay.mockResolvedValue({ agenda });
    await expect(getBilheteriaAgendaStatusToday()).resolves.toMatchObject({ hasOpenAgendaToday: false, openAgendas: [] });
  });

});
