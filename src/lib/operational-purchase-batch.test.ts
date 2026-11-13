import { describe, expect, it } from "vitest";
import { normalizePurchaseBatch, purchaseBatchRange } from "./operational-purchase-batch-contract";

const input = { purchaseIds: [2,1], targetDate: "2099-01-31", validity: "7_days", reason: "Chuva", notifyEmail: false };
describe("purchase batch contract", () => {
  it("normalizes whole purchases without accepting actor or park overrides", () => {
    expect(normalizePurchaseBatch(input)).toEqual({ ...input, purchaseIds: [1,2] });
    expect(() => normalizePurchaseBatch({ ...input, actor: "manager" })).toThrow();
  });
  it.each([
    { purchaseIds: [] }, { purchaseIds: [1,1] }, { purchaseIds: [0] }, { purchaseIds: [2147483648] },
    { purchaseIds: ["1"] }, { purchaseIds: Array.from({ length: 101 }, (_,i) => i+1) },
    { targetDate: "2099-02-29" }, { reason: " " }, { reason: "\0" }, { notifyEmail: "false" },
    { validity: "forever" }, { targetDate: null, validity: "keep" },
  ])("rejects malformed commands %j", patch => { expect(() => normalizePurchaseBatch({ ...input, ...patch })).toThrow(); });
  it("keeps the existing final date only when the new start is inside it", () => {
    expect(purchaseBatchRange("2099-01-31", "2099-02-03", "keep")).toEqual({ validFrom: "2099-01-31", validUntil: "2099-02-03" });
    expect(() => purchaseBatchRange("2099-02-04", "2099-02-03", "keep")).toThrow();
  });
  it("counts inclusive days and clamps calendar months", () => {
    expect(purchaseBatchRange("2099-01-31", "2099-02-03", "7_days").validUntil).toBe("2099-02-06");
    expect(purchaseBatchRange("2099-08-31", "2099-09-03", "6_months").validUntil).toBe("2100-02-28");
  });
});
