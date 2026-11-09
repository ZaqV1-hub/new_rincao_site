import { beforeEach, describe, expect, it, vi } from "vitest";
import { presentChargebackDefense } from "@/lib/chargeback-submission";
import { CieloChargebackError } from "@/lib/cielo-chargeback";
import type { CieloChargebackCase } from "@/lib/chargeback-contract";

const { submit, query } = vi.hoisted(() => ({ submit: vi.fn(), query: vi.fn() }));
vi.mock("@/lib/cielo-chargeback", async (original) => ({ ...await original<typeof import("@/lib/cielo-chargeback")>(), submitCieloChargebackDefense: submit }));
const chargeback = { idCase: "123", idChargeback: "456", establishmentNumber: "1234567890" } as CieloChargebackCase;
beforeEach(() => { vi.clearAllMocks(); query.mockResolvedValue({ rows: [{ id: 1, attempts: 0 }], rowCount: 1 }); });

describe("automatic chargeback submission", () => {
  it("records in-flight intent before transmitting, then archives the receipt", async () => {
    submit.mockImplementation(async () => {
      expect(query.mock.calls[0][0]).toContain("status='submitting'");
      return { code: "102", message: "recebido" };
    });
    await presentChargebackDefense({ query }, 1, chargeback, 2, Buffer.from("pdf"), "Ingresso utilizado");
    expect(submit).toHaveBeenCalledOnce();
    expect(query.mock.calls.at(-1)?.[0]).toContain("status='submitted'");
  });

  it("does not transmit again when case is already in flight", async () => {
    query.mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(presentChargebackDefense({ query }, 1, chargeback, 2, Buffer.from("pdf"), "Ingresso utilizado")).rejects.toThrow();
    expect(submit).not.toHaveBeenCalled();
  });

  it("keeps an uncertain transmission out of the retry-to-send state after the limit", async () => {
    query.mockResolvedValueOnce({ rows: [{ attempts: 11 }], rowCount: 1 });
    submit.mockRejectedValue(new CieloChargebackError("cielo_timeout", true, true));
    await expect(presentChargebackDefense({ query }, 1, chargeback, 2, Buffer.from("pdf"), "Ingresso utilizado")).rejects.toThrow();
    expect(query.mock.calls.at(-1)?.[1]).toContain("uncertain");
    expect(JSON.parse(query.mock.calls.at(-1)?.[1][3])).toEqual({ errorCode: "cielo_timeout" });
  });

  it.each([
    { attempts: 0, transient: false, expected: "rejected" },
    { attempts: 10, transient: true, expected: "retry" },
    { attempts: 11, transient: true, expected: "rejected" },
  ])("stores $expected after a definite failure with $attempts prior attempts", async ({ attempts, transient, expected }) => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, attempts }], rowCount: 1 });
    const failure = new CieloChargebackError(transient ? "cielo_http_429" : "cielo_business_903", transient);
    submit.mockRejectedValueOnce(failure);

    await expect(presentChargebackDefense({ query }, 1, chargeback, 2, Buffer.from("pdf"), "Ingresso utilizado")).rejects.toBe(failure);

    expect(query.mock.calls.at(-1)?.[1][1]).toBe(expected);
  });

  it("leaves persisted intent for reconciliation if saving a successful receipt fails", async () => {
    submit.mockResolvedValue({ code: "102" });
    query.mockResolvedValueOnce({ rows: [{ id: 1, attempts: 0 }], rowCount: 1 }).mockRejectedValue(new Error("database offline"));
    await expect(presentChargebackDefense({ query }, 1, chargeback, 2, Buffer.from("pdf"), "Ingresso utilizado")).rejects.toThrow("database offline");
    expect(submit).toHaveBeenCalledOnce();
  });
});
