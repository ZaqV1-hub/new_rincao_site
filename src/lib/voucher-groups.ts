import type { UserVoucherPurchase } from "@/lib/voucher-contracts";

export function groupUserPurchasesByType(purchases: UserVoucherPurchase[]) {
  return {
    online: purchases.filter((purchase) => purchase.type === "ponli"),
    reservations: purchases.filter((purchase) => purchase.type === "reser"),
  };
}

export function countAvailableVouchers(purchases: UserVoucherPurchase[]) {
  return purchases.reduce(
    (total, purchase) => total + purchase.unusedVoucherCount,
    0,
  );
}
