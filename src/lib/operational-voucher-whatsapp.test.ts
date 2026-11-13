import { describe, expect, it } from "vitest";
import { normalizeOperationalVoucherWhatsapp } from "./operational-voucher-whatsapp";

const valid = { voucherIds: [2,1], phoneNumber: "+55 (11) 98765-4321", destinationConfirmed: true, idempotencyKey: "request-1" };
describe("operational WhatsApp input", () => {
  it("normalizes the destination and selection deterministically", () => {
    expect(normalizeOperationalVoucherWhatsapp(valid)).toEqual({ ...valid, voucherIds: [1,2], phoneNumber: "5511987654321" });
  });
  it.each([
    null, [], {}, { ...valid, actor: { name: "forged" } }, { ...valid, destinationConfirmed: false },
    { ...valid, destinationConfirmed: "true" }, { ...valid, voucherIds: [] }, { ...valid, voucherIds: [1,1] },
    { ...valid, voucherIds: ["1"] }, { ...valid, voucherIds: [0] }, { ...valid, voucherIds: [Number.MAX_SAFE_INTEGER + 1] },
    { ...valid, voucherIds: Array.from({ length: 1001 }, (_, index) => index + 1) },
    { ...valid, phoneNumber: "abc11987654321" }, { ...valid, phoneNumber: "123" }, { ...valid, phoneNumber: "1".repeat(16) },
    { ...valid, idempotencyKey: "" }, { ...valid, idempotencyKey: "a".repeat(101) }, { ...valid, idempotencyKey: "a b" },
  ])("rejects malformed input %#", (input) => {
    expect(() => normalizeOperationalVoucherWhatsapp(input)).toThrowError(expect.objectContaining({ code: "whatsapp_invalid_input", status: 400 }));
  });
});
