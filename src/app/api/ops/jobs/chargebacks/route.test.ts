import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), run: vi.fn(), record: vi.fn() }));
vi.mock("@/lib/ops-auth", () => ({ authenticateOperationsJobRequest: mocks.auth }));
vi.mock("@/lib/chargeback-sync", () => ({ runChargebackSync: mocks.run }));
vi.mock("@/lib/ops-job-runs", () => ({ recordOperationalJobRun: mocks.record }));
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockReturnValue({ ok: true }); mocks.record.mockResolvedValue(1); });
it("requires scheduler credentials before running the automatic sender", async () => {
  mocks.auth.mockReturnValue({ ok: false, response: new Response(null, { status: 401 }) });
  expect((await POST(new Request("https://site.test/api/ops/jobs/chargebacks", { method: "POST" }))).status).toBe(401);
  expect(mocks.run).not.toHaveBeenCalled();
});
it("returns a partial result and records it for operational health", async () => {
  mocks.run.mockResolvedValue({ imported: 2, processed: 1, failed: 1, startedAt: "2026-11-03T12:00:00Z", finishedAt: "2026-11-03T12:00:01Z" });
  const response = await POST(new Request("https://site.test/api/ops/jobs/chargebacks", { method: "POST" }));
  expect(response.status).toBe(200);
  expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ jobName: "chargebacks", status: "partial" }));
});
it("does not expose credentials or raw provider errors", async () => {
  mocks.run.mockRejectedValue(new Error("secret credential provider response"));
  const response = await POST(new Request("https://site.test/api/ops/jobs/chargebacks", { method: "POST" }));
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("secret credential");
});
