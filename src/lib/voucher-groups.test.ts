import { describe, expect, it } from "vitest";
import {
  countAvailableVouchers,
  groupUserPurchasesByType,
} from "@/lib/voucher-groups";
import type { UserVoucherPurchase } from "@/lib/voucher-contracts";

const purchases: UserVoucherPurchase[] = [
  {
    id: 101,
    legacyEncodedId: "MTAx",
    type: "ponli",
    typeLabel: "Compra",
    purchaseDate: "2026-07-20",
    totalValue: "120.00",
    status: "conc",
    statusLabel: "Pago",
    payment: {
      provider: "pagseguro",
      status: 3,
      statusLabel: "Paga",
      methodType: 1,
    },
    unusedVoucherCount: 2,
    voucherCount: 2,
    canGenerateVoucher: true,
    canCancelReservation: false,
    vouchers: [],
  },
  {
    id: 202,
    legacyEncodedId: "MjAy",
    type: "reser",
    typeLabel: "Reserva",
    purchaseDate: "2026-07-18",
    totalValue: "80.00",
    status: "pend",
    statusLabel: "Em processamento",
    payment: {
      provider: "bilheteria",
      status: null,
      statusLabel: "Bilheteria",
      methodType: null,
    },
    unusedVoucherCount: 1,
    voucherCount: 1,
    canGenerateVoucher: false,
    canCancelReservation: true,
    vouchers: [],
  },
];

describe("voucher grouping helpers", () => {
  it("groups purchases by online and reservation types", () => {
    expect(groupUserPurchasesByType(purchases)).toEqual({
      online: [purchases[0]],
      reservations: [purchases[1]],
    });
  });

  it("counts available vouchers across purchases", () => {
    expect(countAvailableVouchers(purchases)).toBe(3);
  });
});
