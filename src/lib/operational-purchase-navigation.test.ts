import { expect, it } from "vitest";
import { purchaseDetailHref, purchaseListHref, readPurchaseListContext, readPurchaseReturnContext } from "./operational-purchase-navigation";
it("round-trips the selected date, page and literal search without accepting an arbitrary destination", () => {
  const context = readPurchaseListContext("2026-11-20", { page: "2", origin: "site", type: "dayuse", query: "Ana & João" });
  const href = purchaseDetailHref(42, context);
  expect(href).toMatch(/^\/painel\/compras\/42\?/);
  const query = Object.fromEntries(new URL(href, "https://local.invalid").searchParams);
  expect(readPurchaseReturnContext(query)).toEqual(context);
  expect(purchaseListHref(context)).toBe("/painel/agenda/2026-11-20?tab=compras&page=2&origin=site&type=dayuse&query=Ana+%26+Jo%C3%A3o");
  expect(readPurchaseReturnContext({ returnDate: "https://external.invalid", returnTo: "//external.invalid" })).toBeNull();
});
it("normalizes malformed query values without losing a valid visit date", () => {
  expect(readPurchaseListContext("2026-11-20", { page: "Infinity", origin: ["site", "gate"], type: "unknown", query: "  Ana  " })).toEqual({ date: "2026-11-20", page: 1, filters: { origin: "all", type: "all", query: "Ana" } });
  expect(readPurchaseReturnContext({ returnDate: "2026-02-30" })).toBeNull();
  expect(readPurchaseListContext("2026-11-20", { query: "a".repeat(121) }).filters.query).toBe("");
});
