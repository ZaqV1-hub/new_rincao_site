import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChargebackDossier, listChargebackCases, saveChargebackDossier, withChargebackWorkerLock } from "@/lib/chargeback-repository";

const { query, release } = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn() }));
vi.mock("@/lib/ingresso-db", () => ({
  getIngressoSistemaDbPool: () => ({ query, connect: async () => ({ query, release }) }),
  getIngressoSistemaDbDialect: () => "postgres",
}));

beforeEach(() => { vi.clearAllMocks(); });

describe("chargeback repository", () => {
  it("does not execute a competing worker and releases its connection", async () => {
    query.mockResolvedValue({ rows: [{ locked: false }] });
    const work = vi.fn();
    expect(await withChargebackWorkerLock(work)).toBeNull();
    expect(work).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledOnce();
  });

  it("unlocks after a failed worker", async () => {
    query.mockResolvedValue({ rows: [{ locked: true }] });
    await expect(withChargebackWorkerLock(async () => { throw new Error("failed"); })).rejects.toThrow("failed");
    expect(query.mock.calls.some(([sql]) => sql.includes("pg_advisory_unlock"))).toBe(true);
    expect(release).toHaveBeenCalledOnce();
  });

  it("validates pagination and purchase identity before querying", async () => {
    await expect(listChargebackCases({ purchaseId: -1 })).rejects.toThrow();
    await expect(listChargebackCases({ limit: 201 })).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });

  it("returns archived bytes and hash without regenerating a PDF", async () => {
    query.mockResolvedValue({ rows: [{ pdf: Buffer.from("%PDF-test"), sha256: "hash", id_case: "123" }] });
    expect(await getChargebackDossier(1)).toEqual({ pdf: Buffer.from("%PDF-test"), sha256: "hash", filename: "123.pdf" });
  });

  it("uses a content hash and conflict key for repeated archival", async () => {
    query.mockResolvedValue({ rows: [{ id: 9 }] });
    const pdf = Buffer.from("%PDF-test");
    expect(await saveChargebackDossier({ query }, 1, { purchaseId: 3 }, pdf, "v1")).toBe(9);
    expect(query.mock.calls[0][0]).toContain("ON CONFLICT (case_id, sha256, snapshot_hash, policy_version)");
    expect(query.mock.calls[0][1]).toContain(pdf);
    expect(query.mock.calls[0][1].some((value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value))).toBe(true);
  });
});
