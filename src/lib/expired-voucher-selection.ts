export type ExpiredVoucherSelection = { voucherId: number; expiredOn: string | null };

export function readExpiredVoucherSelection(value: unknown): ExpiredVoucherSelection[] {
  if (!Array.isArray(value) || value.length > 1000) return [];
  const confirmed: ExpiredVoucherSelection[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || !Number.isSafeInteger(item.voucherId) || item.voucherId < 1) continue;
    if (item.expiredOn !== null && (typeof item.expiredOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.expiredOn))) continue;
    confirmed.push({ voucherId: item.voucherId, expiredOn: item.expiredOn });
  }
  return confirmed;
}
