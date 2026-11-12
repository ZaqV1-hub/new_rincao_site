import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { handleChargebackWebhook } from "@/lib/chargeback-webhook";

const { persist } = vi.hoisted(() => ({ persist: vi.fn() }));
vi.mock("@/lib/chargeback-repository", () => ({ recordChargebackNotification: persist }));

const remoteAddress = "54.207.186.191";
const notification = '{"idCase":90071992547409931234,"idChargeback":22,"establishmentNumber":1234567890}';
const url = "https://example.com/api/cielo/chargebacks/notification";

function request(body: BodyInit, options: { remoteAddress?: string | null; url?: string; contentType?: string; headers?: Record<string, string> } = {}) {
  return new Request(options.url ?? url, {
    method: "POST",
    body,
    headers: {
      "content-type": options.contentType ?? "application/json",
      ...(options.remoteAddress === null ? {} : { "x-rincao-remote-address": options.remoteAddress ?? remoteAddress }),
      ...options.headers,
    },
    ...(body instanceof ReadableStream ? { duplex: "half" } : {}),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CIELO_CHARGEBACK_ENABLED", "true");
  vi.stubEnv("CIELO_CHARGEBACK_WEBHOOK_TOKEN", "legacy-secret-must-not-authorize-callbacks");
  vi.stubEnv("CIELO_CHARGEBACK_ESTABLISHMENT_NUMBERS", "1234567890, 1122334455");
  persist.mockResolvedValue(undefined);
});

afterEach(() => vi.unstubAllEnvs());

it.each([null, "203.0.113.42", "127.0.0.1", "18.229.170.33", "54.207.186.191, 203.0.113.42", "54.207.186.191:443"])("rejects untrusted source %s before reading the body", async (source) => {
  const input = request(notification, { remoteAddress: source });
  expect((await handleChargebackWebhook(input, "notification")).status).toBe(403);
  expect(input.bodyUsed).toBe(false);
  expect(persist).not.toHaveBeenCalled();
});

it.each(["54.207.186.191", "18.229.238.7", "54.232.53.112", "52.202.189.158", "3.216.242.251", "54.166.2.45", "::ffff:54.207.186.191"])("accepts production origin %s without a Cielo token", async (source) => {
  const input = request(notification, { remoteAddress: source });
  expect((await handleChargebackWebhook(input, "notification")).status).toBe(200);
  expect(persist).toHaveBeenCalledWith({
    kind: "notification", idCase: "90071992547409931234", establishmentNumber: "1234567890",
    fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
  });
});

it("does not trust forwarded IPs or the legacy token in headers/query", async () => {
  const input = request(notification, {
    remoteAddress: null, url: url + "?token=legacy-secret-must-not-authorize-callbacks",
    headers: { "x-forwarded-for": remoteAddress, "x-real-ip": remoteAddress, "cf-connecting-ip": remoteAddress,
      "x-cielo-chargeback-token": "legacy-secret-must-not-authorize-callbacks" },
  });
  expect((await handleChargebackWebhook(input, "notification")).status).toBe(403);
  expect(persist).not.toHaveBeenCalled();
});

it("rejects allowed origins when webhook integration is disabled", async () => {
  vi.stubEnv("CIELO_CHARGEBACK_ENABLED", "false");
  expect((await handleChargebackWebhook(request(notification), "notification")).status).toBe(404);
  expect(persist).not.toHaveBeenCalled();
});

it("fails closed without authorized establishments", async () => {
  vi.stubEnv("CIELO_CHARGEBACK_ESTABLISHMENT_NUMBERS", "");
  expect((await handleChargebackWebhook(request(notification), "notification")).status).toBe(503);
  expect(persist).not.toHaveBeenCalled();
});

it("rejects a disallowed establishment", async () => {
  const input = request(notification.replace("1234567890", "1000000000"), {});

  expect((await handleChargebackWebhook(input, "notification")).status).toBe(403);
  expect(persist).not.toHaveBeenCalled();
});

it("only accepts JSON content", async () => {
  const input = request(notification, { contentType: "text/plain" });

  expect((await handleChargebackWebhook(input, "notification")).status).toBe(415);
  expect(persist).not.toHaveBeenCalled();
});

it.each(["1.2", "1e3", "900719925474099312345"])("rejects invalid numeric identifier %s", async (id) => {
  const input = request(notification.replace("90071992547409931234", id), {});

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
  }), {});
  expect(input.headers.has("content-length")).toBe(false);

  expect((await handleChargebackWebhook(input, "notification")).status).toBe(413);
  expect(cancel).toHaveBeenCalledOnce();
  expect(persist).not.toHaveBeenCalled();
});

it("uses a stable identity when the same event is retried", async () => {
  const first = request(notification, {});
  const duplicate = request('{"establishmentNumber":"1234567890","idChargeback":"22","idCase":"90071992547409931234","remainingDaysToTreat":3}', {});

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
    }), {});

    expect((await handleChargebackWebhook(input, "lifecycle")).status).toBe(200);
  }

  expect(persist.mock.calls[0][0].fingerprint).not.toEqual(persist.mock.calls[1][0].fingerprint);
  expect(Object.keys(persist.mock.calls[0][0]).sort()).toEqual(["establishmentNumber", "fingerprint", "idCase", "kind"]);
});

it("returns a retryable failure when durable persistence fails", async () => {
  persist.mockRejectedValueOnce(new Error("private database detail"));
  const response = await handleChargebackWebhook(request(notification, {}), "notification");

  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private database detail");
});

it("accepts the documented notification envelope and persists only event locators", async () => {
  const body = `{"content":[${notification},${notification.replace("90071992547409931234", "23")}],"pageable":{"pageNumber":0,"pageSize":10},"totalElements":2,"transactionDetails":{"private":"must not persist"}}`;

  expect((await handleChargebackWebhook(request(body, {}), "notification")).status).toBe(200);
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
    expect((await handleChargebackWebhook(request(body, {}), "lifecycle")).status).toBe(200);
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
  expect((await handleChargebackWebhook(request(body, {}), kind)).status).toBe(400);
  expect(persist).not.toHaveBeenCalled();
});

it.each(["[]", "null", "{}", "[null]", "[[]]", `[${notification},{}]`])("rejects malformed notification content %s", async (content) => {
  expect((await handleChargebackWebhook(request(`{"content":${content}}`, {}), "notification")).status).toBe(400);
  expect(persist).not.toHaveBeenCalled();
});

it("rejects an ambiguous envelope carrying a direct event too", async () => {
  const body = notification.replace("{", `{"content":[${notification}],`);
  expect((await handleChargebackWebhook(request(body, {}), "notification")).status).toBe(400);
  expect(persist).not.toHaveBeenCalled();
});

it("checks every establishment in a batch before persisting any event", async () => {
  const body = `{"content":[${notification},${notification.replace("1234567890", "1000000000")}]}`;
  expect((await handleChargebackWebhook(request(body, {}), "notification")).status).toBe(403);
  expect(persist).not.toHaveBeenCalled();
});

it("bounds the number of persistence operations per notification request", async () => {
  const body = `{"content":[${Array(101).fill(notification).join(",")}]}`;
  expect((await handleChargebackWebhook(request(body, {}), "notification")).status).toBe(413);
  expect(persist).not.toHaveBeenCalled();
});

it("keeps identities stable when retrying a partially persisted batch", async () => {
  const body = `{"content":[${notification},${notification.replace("90071992547409931234", "23")}]}`;
  persist.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("database unavailable"));
  expect((await handleChargebackWebhook(request(body, {}), "notification")).status).toBe(503);
  expect((await handleChargebackWebhook(request(body, {}), "notification")).status).toBe(200);
  expect(persist.mock.calls).toHaveLength(4);
  expect(persist.mock.calls[0][0]).toEqual(persist.mock.calls[2][0]);
  expect(persist.mock.calls[1][0]).toEqual(persist.mock.calls[3][0]);
});
