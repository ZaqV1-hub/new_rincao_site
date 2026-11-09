import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { handleChargebackWebhook } from "@/lib/chargeback-webhook";

const { persist } = vi.hoisted(() => ({ persist: vi.fn() }));
vi.mock("@/lib/chargeback-repository", () => ({ recordChargebackNotification: persist }));

const token = "test-chargeback-secret-at-least-32-characters";
const notification = '{"idCase":90071992547409931234,"idChargeback":22,"establishmentNumber":1234567890}';
const url = "https://example.com/api/cielo/chargebacks/notification";

function request(body: BodyInit, options: { token?: string; url?: string; contentType?: string } = {}) {
  return new Request(options.url ?? url, {
    method: "POST",
    body,
    headers: {
      "content-type": options.contentType ?? "application/json",
      ...(options.token === undefined ? {} : { "x-cielo-chargeback-token": options.token }),
    },
    ...(body instanceof ReadableStream ? { duplex: "half" } : {}),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CIELO_CHARGEBACK_ENABLED", "true");
  vi.stubEnv("CIELO_CHARGEBACK_WEBHOOK_TOKEN", token);
  vi.stubEnv("CIELO_CHARGEBACK_ESTABLISHMENT_NUMBERS", "1234567890, 1122334455");
  persist.mockResolvedValue(undefined);
});

afterEach(() => vi.unstubAllEnvs());

it("rejects unauthenticated requests before reading the body", async () => {
  const input = request(notification, { token: "incorrect-token" });

  expect((await handleChargebackWebhook(input, "notification")).status).toBe(401);
  expect(input.bodyUsed).toBe(false);
  expect(persist).not.toHaveBeenCalled();
});

it("rejects requests when webhook integration is disabled", async () => {
  vi.stubEnv("CIELO_CHARGEBACK_ENABLED", "false");

  expect((await handleChargebackWebhook(request(notification, { token }), "notification")).status).toBe(404);
  expect(persist).not.toHaveBeenCalled();
});

it("requires a secret of at least 32 characters", async () => {
  vi.stubEnv("CIELO_CHARGEBACK_WEBHOOK_TOKEN", "short");

  expect((await handleChargebackWebhook(request(notification, { token: "short" }), "notification")).status).toBe(503);
  expect(persist).not.toHaveBeenCalled();
});

it("accepts URL authentication for a callback without custom headers", async () => {
  const input = request(notification, { url: url + "?token=" + token });

  expect((await handleChargebackWebhook(input, "notification")).status).toBe(200);
  expect(persist).toHaveBeenCalledWith({
    kind: "notification",
    idCase: "90071992547409931234",
    establishmentNumber: "1234567890",
    fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
  });
});

it("rejects a disallowed establishment", async () => {
  const input = request(notification.replace("1234567890", "1000000000"), { token });

  expect((await handleChargebackWebhook(input, "notification")).status).toBe(403);
  expect(persist).not.toHaveBeenCalled();
});

it("only accepts JSON content", async () => {
  const input = request(notification, { token, contentType: "text/plain" });

  expect((await handleChargebackWebhook(input, "notification")).status).toBe(415);
  expect(persist).not.toHaveBeenCalled();
});

it.each(["1.2", "1e3", "900719925474099312345"])("rejects invalid numeric identifier %s", async (id) => {
  const input = request(notification.replace("90071992547409931234", id), { token });

  expect((await handleChargebackWebhook(input, "notification")).status).toBe(400);
  expect(persist).not.toHaveBeenCalled();
});

it("limits actual streamed bytes even without Content-Length", async () => {
  const encoder = new TextEncoder();
  const cancel = vi.fn();
  const input = request(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(notification));
      controller.enqueue(encoder.encode(" ".repeat(64 * 1024)));
    },
    cancel,
  }), { token });
  expect(input.headers.has("content-length")).toBe(false);

  expect((await handleChargebackWebhook(input, "notification")).status).toBe(413);
  expect(cancel).toHaveBeenCalledOnce();
  expect(persist).not.toHaveBeenCalled();
});

it("uses a stable identity when the same event is retried", async () => {
  const first = request(notification, { token });
  const duplicate = request('{"establishmentNumber":"1234567890","idChargeback":"22","idCase":"90071992547409931234","remainingDaysToTreat":3}', { token });

  expect((await handleChargebackWebhook(first, "notification")).status).toBe(200);
  expect((await handleChargebackWebhook(duplicate, "notification")).status).toBe(200);
  expect(persist).toHaveBeenCalledTimes(2);
  expect(persist.mock.calls[0][0]).toEqual(persist.mock.calls[1][0]);
});

it("does not collapse distinct lifecycle messages for the same case and date", async () => {
  for (const message of ["Em análise com a Cielo", "A favor do Estabelecimento"]) {
    const input = request(JSON.stringify({
      caseId: "22",
      establishmentNumber: "1234567890",
      message,
      executionDate: "2026-11-03",
      ActionCicleDate: "2026-11-03",
    }), { token });

    expect((await handleChargebackWebhook(input, "lifecycle")).status).toBe(200);
  }

  expect(persist.mock.calls[0][0].fingerprint).not.toEqual(persist.mock.calls[1][0].fingerprint);
  expect(Object.keys(persist.mock.calls[0][0]).sort()).toEqual(["establishmentNumber", "fingerprint", "idCase", "kind"]);
});

it("returns a retryable failure when durable persistence fails", async () => {
  persist.mockRejectedValueOnce(new Error("private database detail"));
  const response = await handleChargebackWebhook(request(notification, { token }), "notification");

  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private database detail");
});

it("accepts the documented notification envelope and persists only event locators", async () => {
  const body = `{"content":[${notification},${notification.replace("90071992547409931234", "23")}],"pageable":{"pageNumber":0,"pageSize":10},"totalElements":2,"transactionDetails":{"private":"must not persist"}}`;

  expect((await handleChargebackWebhook(request(body, { token }), "notification")).status).toBe(200);
  expect(persist.mock.calls.map(([event]) => event.idCase)).toEqual(["90071992547409931234", "23"]);
  for (const [event] of persist.mock.calls) {
    expect(event).toEqual({
      kind: "notification", idCase: expect.any(String), establishmentNumber: "1234567890",
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  }
});

it("normalizes the documented lifecycle idcase and legacy caseId to the same event", async () => {
  for (const id of ['"idcase":90071992547409931234', '"caseId":"90071992547409931234"', '"idcase":90071992547409931234,"caseId":"90071992547409931234"']) {
    const body = `{${id},"establishmentNumber":1234567890,"message":"A favor do Estabelecimento","executionDate":"2024-12-22","ActionCicleDate":"2024-12-22"}`;
    expect((await handleChargebackWebhook(request(body, { token }), "lifecycle")).status).toBe(200);
  }
  expect(persist.mock.calls[0][0].idCase).toBe("90071992547409931234");
  expect(persist.mock.calls[0][0]).toEqual(persist.mock.calls[1][0]);
  expect(persist.mock.calls[0][0]).toEqual(persist.mock.calls[2][0]);
});

it.each([
  ['"idcase":"23","caseId":"22"', "lifecycle"],
  ['"idcase":null,"caseId":"22"', "lifecycle"],
  ['"idCase":"22","caseId":"23"', "notification"],
  ['"idCase":"22","idcase":"23"', "notification"],
] as const)("rejects conflicting or malformed case aliases: %s", async (ids, kind) => {
  const body = `{${ids},"idChargeback":22,"establishmentNumber":1234567890}`;
  expect((await handleChargebackWebhook(request(body, { token }), kind)).status).toBe(400);
  expect(persist).not.toHaveBeenCalled();
});

it.each(["[]", "null", "{}", "[null]", "[[]]", `[${notification},{}]`])("rejects malformed notification content %s", async (content) => {
  expect((await handleChargebackWebhook(request(`{"content":${content}}`, { token }), "notification")).status).toBe(400);
  expect(persist).not.toHaveBeenCalled();
});

it("rejects an ambiguous envelope carrying a direct event too", async () => {
  const body = notification.replace("{", `{"content":[${notification}],`);
  expect((await handleChargebackWebhook(request(body, { token }), "notification")).status).toBe(400);
  expect(persist).not.toHaveBeenCalled();
});

it("checks every establishment in a batch before persisting any event", async () => {
  const body = `{"content":[${notification},${notification.replace("1234567890", "1000000000")}]}`;
  expect((await handleChargebackWebhook(request(body, { token }), "notification")).status).toBe(403);
  expect(persist).not.toHaveBeenCalled();
});

it("bounds the number of persistence operations per notification request", async () => {
  const body = `{"content":[${Array(101).fill(notification).join(",")}]}`;
  expect((await handleChargebackWebhook(request(body, { token }), "notification")).status).toBe(413);
  expect(persist).not.toHaveBeenCalled();
});

it("keeps identities stable when retrying a partially persisted batch", async () => {
  const body = `{"content":[${notification},${notification.replace("90071992547409931234", "23")}]}`;
  persist.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("database unavailable"));
  expect((await handleChargebackWebhook(request(body, { token }), "notification")).status).toBe(503);
  expect((await handleChargebackWebhook(request(body, { token }), "notification")).status).toBe(200);
  expect(persist.mock.calls).toHaveLength(4);
  expect(persist.mock.calls[0][0]).toEqual(persist.mock.calls[2][0]);
  expect(persist.mock.calls[1][0]).toEqual(persist.mock.calls[3][0]);
});
