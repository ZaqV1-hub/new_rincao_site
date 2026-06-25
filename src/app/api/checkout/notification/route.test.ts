import { beforeEach, describe, expect, it, vi } from "vitest";

const proxyCheckoutNotification = vi.fn();

vi.mock("@/lib/checkout-notification-proxy", () => ({
  proxyCheckoutNotification,
}));

describe("checkout notification BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    proxyCheckoutNotification.mockResolvedValue({
      status: 200,
      contentType: "text/plain; charset=UTF-8",
      body: "ok",
    });
  });

  it("returns the native or proxied notification response", async () => {
    const { POST } = await import("@/app/api/checkout/notification/route");
    const request = new Request(
      "https://example.com/api/checkout/notification?source=cielo",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          Sale: {
            MerchantOrderId: "456",
            Payment: {
              Status: 2,
            },
          },
        }),
      },
    );
    const response = await POST(request);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=UTF-8");
    expect(proxyCheckoutNotification).toHaveBeenCalledWith(request);
    expect(body).toBe("ok");
  });

  it("normalizes unexpected notification failures", async () => {
    proxyCheckoutNotification.mockRejectedValue(new Error("network failed"));

    const { POST } = await import("@/app/api/checkout/notification/route");
    const response = await POST(
      new Request("https://example.com/api/checkout/notification", {
        method: "POST",
        body: "{}",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "checkout_notification_unavailable",
        message: "Nao foi possivel processar a notificacao agora.",
      },
    });
  });
});
