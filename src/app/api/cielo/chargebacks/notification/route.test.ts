import { expect, it, vi } from "vitest";
import { POST } from "./route";

const { handle } = vi.hoisted(() => ({ handle: vi.fn() }));
vi.mock("@/lib/chargeback-webhook", () => ({ handleChargebackWebhook: handle }));

it("dispatches the notification callback with its own event type", async () => {
  const request = new Request("https://example.com/api/cielo/chargebacks/notification", { method: "POST" });
  handle.mockResolvedValueOnce(new Response(null, { status: 200 }));

  expect((await POST(request)).status).toBe(200);
  expect(handle).toHaveBeenCalledWith(request, "notification");
});
