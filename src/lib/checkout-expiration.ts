import type { UserVoucherPurchase } from "@/lib/voucher-contracts";

export function canContinuePayment(
  purchase: Pick<UserVoucherPurchase, "type" | "status" | "checkoutExpiresAt">,
  now = Date.now(),
) {
  if (purchase.type !== "ponli" || purchase.status !== "pend") return false;
  const expiresAt = Date.parse(purchase.checkoutExpiresAt ?? "");
  return Number.isFinite(expiresAt) && now < expiresAt;
}
