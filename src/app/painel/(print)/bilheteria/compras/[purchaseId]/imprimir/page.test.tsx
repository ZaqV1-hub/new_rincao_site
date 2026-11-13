import { beforeEach, expect, it, vi } from "vitest";
import Page from "./page";
const mocks = vi.hoisted(() => ({ access: vi.fn(), print: vi.fn() }));
vi.mock("@/lib/painel-session", () => ({ requirePainelAccess: mocks.access }));
vi.mock("@/lib/painel-bilheteria", () => ({ getPainelBilheteriaPurchasePrintModel: mocks.print, asPainelBilheteriaError: (error: unknown) => error }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: () => { throw new Error("REDIRECT"); } }));
beforeEach(() => { mocks.access.mockReset().mockResolvedValue({ authSource: "panel", actorName: "Ana", actorCpf: "52998224725" }); mocks.print.mockReset().mockResolvedValue({ purchaseId: 8, vouchers: [] }); });
it("passes only selected IDs to the print service and uses the session actor", async () => {
  await Page({ params: Promise.resolve({ purchaseId: "8" }), searchParams: Promise.resolve({ voucherIds: "4,9" }) });
  expect(mocks.print).toHaveBeenCalledWith(8, { name: "Ana", cpf: "52998224725" }, [4, 9]);
});
it("preserves the whole-purchase print link without a query", async () => {
  await Page({ params: Promise.resolve({ purchaseId: "8" }) });
  expect(mocks.print).toHaveBeenCalledWith(8, { name: "Ana", cpf: "52998224725" }, undefined);
});
it.each(["", "1,1", "1e2", "-1", "1,", "9007199254740992", ["1", "2"]])("rejects ambiguous selection %j before print or QR generation", async (voucherIds) => {
  await expect(Page({ params: Promise.resolve({ purchaseId: "8" }), searchParams: Promise.resolve({ voucherIds }) })).rejects.toThrow("NOT_FOUND");
  expect(mocks.print).not.toHaveBeenCalled();
});
it("rejects operations identity even if it passed the legacy access helper", async () => {
  mocks.access.mockResolvedValue({ authSource: "operations" });
  await expect(Page({ params: Promise.resolve({ purchaseId: "8" }) })).rejects.toThrow("REDIRECT");
  expect(mocks.print).not.toHaveBeenCalled();
});
