import { describe, expect, it } from "vitest";
import {
  calculateTripSettlement,
  type TripSettlementInput,
  type TripSettlementOnlineParticipant,
  type TripSettlementVehicle,
} from "./trip-settlement-calculation";

const zeroCounts = {
  adult: 0,
  child: 0,
  coordinator: 0,
  pcdChild: 0,
  pcdAdult: 0,
  pcdCompanion: 0,
  teacherChild: 0,
  exempt: 0,
};

function vehicle(id: number, counts: Partial<TripSettlementVehicle["counts"]>, status: TripSettlementVehicle["status"] = "concluido"): TripSettlementVehicle {
  return { id, status, counts: { ...zeroCounts, ...counts } };
}

function online(voucherId: number, category: TripSettlementOnlineParticipant["category"], paidCents: number, refundRequested = false): TripSettlementOnlineParticipant {
  return { voucherId, category, paidCents, refundRequested };
}

const emptyTrip: TripSettlementInput = {
  vehicles: [],
  onlineParticipants: [],
  adultPriceCents: 0,
  childPriceCents: 0,
  adultCourtesies: 0,
  childCourtesies: 0,
};

const acceptanceTrip: TripSettlementInput = {
  vehicles: [vehicle(1, { adult: 20, child: 30 })],
  onlineParticipants: [
    ...Array.from({ length: 5 }, (_, i) => online(i + 1, "adult", 10000)),
    ...Array.from({ length: 10 }, (_, i) => online(i + 6, "child", 8000)),
  ],
  adultPriceCents: 10000,
  childPriceCents: 8000,
  adultCourtesies: 2,
  childCourtesies: 3,
};

describe("calculateTripSettlement", () => {
  it("reconciles the acceptance trip by category", () => {
    expect(calculateTripSettlement(acceptanceTrip)).toEqual({
      counts: { ...zeroCounts, adult: 20, child: 30 },
      adultToCharge: 13,
      childToCharge: 17,
      onlinePresentCents: 130000,
      refundsDueCents: 0,
      schoolChargeCents: 266000,
      totalTripCents: 396000,
      notChargedCount: 0,
      warnings: [],
    });
  });

  it("returns zero for an empty trip and clamps unused courtesies", () => {
    expect(calculateTripSettlement({ ...emptyTrip, adultCourtesies: 1 })).toEqual({
      counts: zeroCounts,
      adultToCharge: 0,
      childToCharge: 0,
      onlinePresentCents: 0,
      refundsDueCents: 0,
      schoolChargeCents: 0,
      totalTripCents: 0,
      notChargedCount: 0,
      warnings: [],
    });
  });

  it("sums completed vehicles and reports unfinished counting once", () => {
    const result = calculateTripSettlement({
      ...emptyTrip,
      vehicles: [
        vehicle(1, { adult: 2, child: 1 }),
        vehicle(2, { adult: 3, child: 4 }),
        vehicle(3, { adult: 100, child: 100, exempt: 1 }, "contando"),
        vehicle(4, { adult: 100, child: 100, exempt: 1 }, "aguardando"),
      ],
    });
    expect(result).toMatchObject({
      counts: { ...zeroCounts, adult: 5, child: 5 },
      warnings: ["incomplete_vehicle_count"],
    });
  });

  it("keeps the six non-chargeable categories out of school charges", () => {
    const counts = { coordinator: 1, pcdChild: 2, pcdAdult: 3, pcdCompanion: 4, teacherChild: 5, exempt: 6 };
    expect(calculateTripSettlement({
      ...emptyTrip,
      adultPriceCents: 10000,
      childPriceCents: 8000,
      vehicles: [vehicle(1, counts)],
    })).toMatchObject({
      counts: { ...zeroCounts, ...counts },
      notChargedCount: 21,
      adultToCharge: 0,
      childToCharge: 0,
      schoolChargeCents: 0,
    });
  });

  it("warns per category when more people paid online than were counted", () => {
    const result = calculateTripSettlement({
      ...emptyTrip,
      adultPriceCents: 10000,
      childPriceCents: 8000,
      vehicles: [vehicle(1, { adult: 1 })],
      onlineParticipants: [online(1, "adult", 9000), online(2, "adult", 8000), online(3, "child", 7000)],
    });
    expect(result).toMatchObject({
      adultToCharge: 0,
      childToCharge: 0,
      schoolChargeCents: 0,
      onlinePresentCents: 24000,
      totalTripCents: 24000,
      warnings: ["online_adult_count_exceeds_vehicle_count", "online_child_count_exceeds_vehicle_count"],
    });
  });

  it("changes only the school charge when its prices change", () => {
    expect(calculateTripSettlement({ ...acceptanceTrip, adultPriceCents: 20000, childPriceCents: 4000 })).toMatchObject({
      onlinePresentCents: 130000,
      schoolChargeCents: 328000,
      totalTripCents: 458000,
    });
  });

  it("removes absent vouchers from present counts and totals without deducting refunds twice", () => {
    expect(calculateTripSettlement({
      ...emptyTrip,
      vehicles: [vehicle(1, { adult: 2, child: 1 })],
      adultPriceCents: 10000,
      childPriceCents: 8000,
      onlineParticipants: [online(1, "adult", 9351), online(2, "adult", 9133, true), online(3, "child", 7001, true)],
    })).toMatchObject({
      adultToCharge: 1,
      childToCharge: 1,
      onlinePresentCents: 9351,
      refundsDueCents: 16134,
      schoolChargeCents: 18000,
      totalTripCents: 27351,
      warnings: [],
    });
  });

  it("uses each voucher and its paid cents independently for vouchers from the same purchase", () => {
    expect(calculateTripSettlement({
      ...emptyTrip,
      vehicles: [vehicle(1, { child: 2 })],
      onlineParticipants: [online(11, "child", 7001), online(12, "child", 7002)],
    })).toMatchObject({ childToCharge: 0, onlinePresentCents: 14003, totalTripCents: 14003, warnings: [] });
  });

  it("rejects duplicate vehicles even when one is unfinished", () => {
    expect(() => calculateTripSettlement({
      ...emptyTrip,
      vehicles: [vehicle(1, { adult: 1 }), vehicle(1, {}, "aguardando")],
    })).toThrow("duplicate_vehicle_id");
  });

  it("rejects duplicate vouchers across present and refund selections", () => {
    expect(() => calculateTripSettlement({
      ...emptyTrip,
      onlineParticipants: [online(1, "adult", 10000), online(1, "adult", 10000, true)],
    })).toThrow("duplicate_voucher_id");
  });

  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects invalid amounts and counts (%s)", (value) => {
    expect(() => calculateTripSettlement({ ...emptyTrip, adultPriceCents: value })).toThrow("adultPriceCents");
    expect(() => calculateTripSettlement({ ...emptyTrip, childPriceCents: value })).toThrow("childPriceCents");
    expect(() => calculateTripSettlement({ ...emptyTrip, adultCourtesies: value })).toThrow("adultCourtesies");
    expect(() => calculateTripSettlement({ ...emptyTrip, childCourtesies: value })).toThrow("childCourtesies");
    expect(() => calculateTripSettlement({ ...emptyTrip, vehicles: [vehicle(1, { exempt: value }, "contando")] })).toThrow("counts.exempt");
    expect(() => calculateTripSettlement({ ...emptyTrip, onlineParticipants: [online(1, "adult", value, true)] })).toThrow("paidCents");
  });

  it("rejects invalid IDs, status, categories, and refund flags", () => {
    expect(() => calculateTripSettlement({ ...emptyTrip, vehicles: [vehicle(0, {})] })).toThrow("invalid_vehicle_id");
    expect(() => calculateTripSettlement({ ...emptyTrip, onlineParticipants: [online(0, "adult", 0)] })).toThrow("invalid_voucher_id");
    expect(() => calculateTripSettlement({
      ...emptyTrip,
      vehicles: [vehicle(1, {}, "done" as TripSettlementVehicle["status"])],
    })).toThrow("invalid_vehicle_status");
    const vehicleWithUnknownCategory = { ...vehicle(1, {}), counts: { ...zeroCounts, student: 1 } };
    expect(() => calculateTripSettlement({ ...emptyTrip, vehicles: [vehicleWithUnknownCategory] })).toThrow("invalid_vehicle_counts");
    expect(() => calculateTripSettlement({
      ...emptyTrip,
      onlineParticipants: [online(1, "student" as TripSettlementOnlineParticipant["category"], 100)],
    })).toThrow("invalid_online_category");
    expect(() => calculateTripSettlement({
      ...emptyTrip,
      onlineParticipants: [online(1, "adult", 100, "false" as unknown as boolean)],
    })).toThrow("invalid_refund_requested");
  });

  it("accepts a value at the safe integer limit", () => {
    expect(calculateTripSettlement({
      ...emptyTrip,
      onlineParticipants: [online(1, "adult", Number.MAX_SAFE_INTEGER)],
    }).totalTripCents).toBe(Number.MAX_SAFE_INTEGER);
  });

  const max = Number.MAX_SAFE_INTEGER;
  it.each<{ field: string; overrides: Partial<TripSettlementInput> }>([
    { field: "counts.child", overrides: { vehicles: [vehicle(1, { child: max }), vehicle(2, { child: 1 })] } },
    { field: "notChargedCount", overrides: { vehicles: [vehicle(1, { exempt: max, coordinator: 1 })] } },
    { field: "onlinePresentCents", overrides: { onlineParticipants: [online(1, "adult", max), online(2, "child", 1)] } },
    { field: "refundsDueCents", overrides: { onlineParticipants: [online(1, "adult", max, true), online(2, "child", 1, true)] } },
    { field: "schoolChargeCents", overrides: { vehicles: [vehicle(1, { adult: 2 })], adultPriceCents: max } },
    { field: "schoolChargeCents", overrides: { vehicles: [vehicle(1, { adult: 1, child: 1 })], adultPriceCents: max, childPriceCents: 1 } },
    { field: "totalTripCents", overrides: { vehicles: [vehicle(1, { adult: 2 })], onlineParticipants: [online(1, "adult", max)], adultPriceCents: 1 } },
  ])("rejects overflow of $field", ({ field, overrides }) => {
    expect(() => calculateTripSettlement({ ...emptyTrip, ...overrides })).toThrow(field);
  });
});
