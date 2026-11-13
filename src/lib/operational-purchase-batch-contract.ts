import { isCivilDate, voucherValidityRange, type OperationalValidity } from "./operational-date";

export type PurchaseBatchInput = {
  purchaseIds: number[]; targetDate: string | null; validity: OperationalValidity | "keep"; reason: string; notifyEmail: boolean;
};
export type PurchaseBatchItem = {
  purchaseId: number; status: "eligible" | "adjustment_required" | "rejected"; message: string;
  vouchers: { id: number; from: string; until: string; nextFrom: string; nextUntil: string }[];
};
export type PurchaseBatchPreview = { fingerprint: string; items: PurchaseBatchItem[] };
export type PurchaseBatchResult = { batchId: string; applied: number[]; adjustments: number[]; rejected: number[]; emailPending: number };
export class PurchaseBatchError extends Error {
  constructor(readonly code: string, message: string, readonly status = 409) { super(message); }
}
export function invalidPurchaseBatch(): never { throw new PurchaseBatchError("batch_invalid_input", "Informe compras, data ou validade, motivo e opção de aviso válidos.", 400); }
export function normalizePurchaseBatch(value: unknown): PurchaseBatchInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalidPurchaseBatch();
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some(key => !["purchaseIds","targetDate","validity","reason","notifyEmail"].includes(key)) ||
    !Array.isArray(data.purchaseIds) || data.purchaseIds.length < 1 || data.purchaseIds.length > 100 ||
    data.purchaseIds.some(id => !Number.isInteger(id) || id <= 0 || id > 2147483647) || new Set(data.purchaseIds).size !== data.purchaseIds.length ||
    (data.targetDate !== null && !isCivilDate(data.targetDate)) || !["keep","day","7_days","30_days","6_months"].includes(String(data.validity)) ||
    (data.targetDate === null && data.validity === "keep") || typeof data.reason !== "string" || !data.reason.trim() || data.reason.length > 1000 || data.reason.includes("\0") ||
    typeof data.notifyEmail !== "boolean") return invalidPurchaseBatch();
  return { purchaseIds: [...data.purchaseIds].sort((a,b) => a-b), targetDate: data.targetDate as string | null,
    validity: data.validity as PurchaseBatchInput["validity"], reason: data.reason.trim(), notifyEmail: data.notifyEmail };
}
export function purchaseBatchRange(start: string, currentEnd: string, validity: PurchaseBatchInput["validity"]) {
  if (!isCivilDate(start) || !isCivilDate(currentEnd)) return invalidPurchaseBatch();
  if (validity !== "keep") return voucherValidityRange(start,validity);
  if (start > currentEnd) throw new PurchaseBatchError("batch_validity_before_start", "A nova visita ultrapassa a validade atual. Escolha uma nova validade.");
  return { validFrom: start, validUntil: currentEnd };
}
