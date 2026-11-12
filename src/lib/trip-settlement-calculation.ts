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

export type TripSettlementCounts = typeof zeroCounts;
const countCategories = Object.keys(zeroCounts) as (keyof TripSettlementCounts)[];

export type TripSettlementVehicle = {
  id: number;
  status: "aguardando" | "contando" | "concluido";
  counts: TripSettlementCounts;
};

export type TripSettlementOnlineParticipant = {
  voucherId: number;
  category: "adult" | "child";
  paidCents: number;
  refundRequested: boolean;
};

export type TripSettlementInput = {
  vehicles: readonly TripSettlementVehicle[];
  onlineParticipants: readonly TripSettlementOnlineParticipant[];
  adultPriceCents: number;
  childPriceCents: number;
  adultCourtesies: number;
  childCourtesies: number;
};

export type TripSettlementWarning =
  | "incomplete_vehicle_count"
  | "online_adult_count_exceeds_vehicle_count"
  | "online_child_count_exceeds_vehicle_count";

export type TripSettlementResult = {
  counts: TripSettlementCounts;
  adultToCharge: number;
  childToCharge: number;
  onlinePresentCents: number;
  refundsDueCents: number;
  schoolChargeCents: number;
  totalTripCents: number;
  notChargedCount: number;
  warnings: TripSettlementWarning[];
};

function safeNonNegativeInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative safe integer`);
  }
  return value;
}

export function calculateTripSettlement(input: TripSettlementInput): TripSettlementResult {
  if (![input?.vehicles, input?.onlineParticipants].every(Array.isArray)) {
    throw new Error("invalid_trip_settlement_input");
  }
  const adultPriceCents = safeNonNegativeInteger(input.adultPriceCents, "adultPriceCents");
  const childPriceCents = safeNonNegativeInteger(input.childPriceCents, "childPriceCents");
  const adultCourtesies = safeNonNegativeInteger(input.adultCourtesies, "adultCourtesies");
  const childCourtesies = safeNonNegativeInteger(input.childCourtesies, "childCourtesies");

  const counts = { ...zeroCounts };
  const vehicleIds = new Set<number>();
  let hasIncompleteCount = false;
  for (const vehicle of input.vehicles) {
    if (!Number.isSafeInteger(vehicle.id) || vehicle.id <= 0) throw new Error("invalid_vehicle_id");
    if (vehicleIds.has(vehicle.id)) throw new Error("duplicate_vehicle_id");
    vehicleIds.add(vehicle.id);

    const completed = vehicle.status === "concluido";
    if (!completed) {
      if (vehicle.status !== "aguardando" && vehicle.status !== "contando") {
        throw new Error("invalid_vehicle_status");
      }
      hasIncompleteCount = true;
    }

    if (!vehicle.counts || Object.keys(vehicle.counts).length !== countCategories.length) {
      throw new Error("invalid_vehicle_counts");
    }
    for (const category of countCategories) {
      if (!Object.hasOwn(vehicle.counts, category)) throw new Error("invalid_vehicle_counts");
      const field = `counts.${category}`;
      const quantity = safeNonNegativeInteger(vehicle.counts[category], field);
      if (completed) counts[category] = safeNonNegativeInteger(counts[category] + quantity, field);
    }
  }

  const voucherIds = new Set<number>();
  const onlinePresent = { adult: 0, child: 0 };
  let onlinePresentCents = 0;
  let refundsDueCents = 0;
  for (const { voucherId, category, paidCents, refundRequested } of input.onlineParticipants) {
    if (!Number.isSafeInteger(voucherId) || voucherId <= 0) throw new Error("invalid_voucher_id");
    if (voucherIds.has(voucherId)) throw new Error("duplicate_voucher_id");
    voucherIds.add(voucherId);
    if (category !== "adult" && category !== "child") throw new Error("invalid_online_category");
    if (typeof refundRequested !== "boolean") throw new Error("invalid_refund_requested");
    safeNonNegativeInteger(paidCents, "paidCents");

    if (refundRequested) {
      refundsDueCents = safeNonNegativeInteger(refundsDueCents + paidCents, "refundsDueCents");
    } else {
      onlinePresent[category] += 1;
      onlinePresentCents = safeNonNegativeInteger(onlinePresentCents + paidCents, "onlinePresentCents");
    }
  }

  const warnings: TripSettlementWarning[] = [];
  if (hasIncompleteCount) warnings.push("incomplete_vehicle_count");
  if (onlinePresent.adult > counts.adult) warnings.push("online_adult_count_exceeds_vehicle_count");
  if (onlinePresent.child > counts.child) warnings.push("online_child_count_exceeds_vehicle_count");

  const adultToCharge = Math.max(0, Math.max(0, counts.adult - onlinePresent.adult) - adultCourtesies);
  const childToCharge = Math.max(0, Math.max(0, counts.child - onlinePresent.child) - childCourtesies);
  const schoolChargeCents = safeNonNegativeInteger(
    adultToCharge * adultPriceCents + childToCharge * childPriceCents,
    "schoolChargeCents",
  );
  const notChargedCount = safeNonNegativeInteger(
    counts.coordinator + counts.pcdChild + counts.pcdAdult + counts.pcdCompanion + counts.teacherChild + counts.exempt,
    "notChargedCount",
  );

  return {
    counts,
    adultToCharge,
    childToCharge,
    onlinePresentCents,
    refundsDueCents,
    schoolChargeCents,
    totalTripCents: safeNonNegativeInteger(onlinePresentCents + schoolChargeCents, "totalTripCents"),
    notChargedCount,
    warnings,
  };
}
