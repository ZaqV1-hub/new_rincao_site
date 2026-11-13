import { isCivilDate } from "@/lib/operational-date";
import type { DayPurchaseFilters } from "@/lib/operational-day-lists";

export type PurchaseListContext = { date: string; page: number; filters: DayPurchaseFilters };
export type PurchaseNavigationQuery = Record<string, string | string[] | undefined>;
export function readPurchaseListContext(date: string, query: PurchaseNavigationQuery): PurchaseListContext {
  if (!isCivilDate(date)) throw new Error("Data de visita inválida.");
  const page = typeof query.page === "string" && /^[1-9]\d*$/.test(query.page) ? Number(query.page) : 1;
  const search = typeof query.query === "string" ? query.query.trim() : "";
  return { date, page: Number.isSafeInteger(page) && page <= 1000000 ? page : 1, filters: {
    origin: query.origin === "site" || query.origin === "gate" ? query.origin : "all",
    type: query.type === "dayuse" || query.type === "group" ? query.type : "all",
    query: search.length <= 120 && !/[\u0000-\u001f]/.test(search) ? search : "",
  } };
}
export function readPurchaseReturnContext(query: PurchaseNavigationQuery): PurchaseListContext | null {
  if (!isCivilDate(query.returnDate)) return null;
  return readPurchaseListContext(query.returnDate, { page: query.returnPage, origin: query.returnOrigin, type: query.returnType, query: query.returnQuery });
}
export function purchaseListHref({ date, page, filters }: PurchaseListContext) {
  return `/painel/agenda/${date}?${new URLSearchParams({ tab: "compras", page: String(page), ...filters })}`;
}
export function purchaseDetailHref(purchaseId: number, { date, page, filters }: PurchaseListContext) {
  return `/painel/compras/${purchaseId}?${new URLSearchParams({ returnDate: date, returnPage: String(page), returnOrigin: filters.origin, returnType: filters.type, returnQuery: filters.query })}`;
}
