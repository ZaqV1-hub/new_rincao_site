import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "node:https";
import { readFile } from "node:fs/promises";
import { parseCieloChargebackCase, parseChargebackJson, listCieloChargebacks, listCieloChargebackPage, getCieloChargebackLifecycle, getCieloChargebackDocument, isCieloChargebackConfigured, submitCieloChargebackDefense } from "./cielo-chargeback";

vi.mock("node:https", () => ({ request: vi.fn() }));
vi.mock("node:fs/promises", () => ({ readFile: vi.fn() }));

const fixture = {
  idCase: "12345678901234567890", idChargeback: "98765432109876543210", establishmentNumber: "1234567890",
  treatmentDeadline: "2026-11-30", transactionAmount: "100.01",
  transactionDetails: { tid: "TID123", nsu: 96207, authorization: "001234", transactionDate: "2026-10-30", truncatedCard: "123456******1234", cardAssociationName: "Visa" },
  chargebackDetails: { reasonCode: "131", reasonDescription: "Serviços não recebidos" },
};
type Reply = { body?: unknown; raw?: string; status?: number; error?: string; hang?: boolean };
const requests: { url: string; options: Record<string, unknown>; body: string; rawBody: Buffer }[] = [];
let replies: Reply[];
const originalEnv = process.env;

beforeEach(() => {
  vi.clearAllMocks();
  vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
  process.env = { ...originalEnv, CIELO_CHARGEBACK_ENABLED: "true", CIELO_CHARGEBACK_ENVIRONMENT: "sandbox", CIELO_CHARGEBACK_CLIENT_ID: "client", CIELO_CHARGEBACK_CLIENT_SECRET: "secret", CIELO_CHARGEBACK_CERT_PATH: "/secret/cert.pem", CIELO_CHARGEBACK_KEY_PATH: "/secret/key.pem", CIELO_CHARGEBACK_ESTABLISHMENT_NUMBERS: "1234567890", CIELO_CHARGEBACK_USER_EMAIL: "ops@example.test" };
  vi.mocked(readFile).mockResolvedValue(Buffer.from("pem"));
  requests.length = 0;
  replies = [{ body: { access_token: "token", expires_in: 300 } }];
  vi.mocked(request).mockImplementation(((url: URL, options: Record<string, unknown>, callback: (response: EventEmitter) => void) => {
    const req = new EventEmitter() as EventEmitter & { end: (body: string | Buffer) => void; destroy: () => void };
    req.destroy = () => { req.emit("error", new Error("destroyed")); };
    req.end = (body) => {
      requests.push({ url: String(url), options, body: body?.toString() ?? "", rawBody: Buffer.from(body ?? "") });
      const reply = replies.shift();
      queueMicrotask(() => {
        if (!reply) return req.emit("error", new Error("No mocked response"));
        if (reply.hang) return;
        if (reply.error) return req.emit("error", new Error(reply.error));
        const response = Object.assign(new EventEmitter(), { statusCode: reply.status ?? 200 });
        callback(response);
        response.emit("data", Buffer.from(reply.raw ?? JSON.stringify(reply.body)));
        response.emit("end");
      });
    };
    return req;
  }) as typeof request);
});
afterEach(() => { process.env = originalEnv; vi.useRealTimers(); });

describe("Cielo chargeback contract", () => {
  it("keeps 20-digit identifiers and monetary decimal bytes losslessly, including escaped strings", () => {
    const parsed = parseChargebackJson('{"idCase":12345678901234567890,"amount":100.01,"text":"\\\"12345678901234567890\\\"","n":1e2}');
    expect(parsed).toMatchObject({ idCase: "12345678901234567890", amount: "100.01", text: '"12345678901234567890"' });
    expect(() => parseChargebackJson('{"id":01}')).toThrow();
    expect(() => parseChargebackJson('{123:1}')).toThrow();
  });
  it("normalizes numeric fields and rejects already rounded identifiers", () => {
    expect(parseCieloChargebackCase(fixture)).toMatchObject({ idCase: fixture.idCase, transactionDetails: { nsu: "96207" }, remoteStatus: "PENDING" });
    expect(() => parseCieloChargebackCase({ ...fixture, idCase: 12345678901234567890 })).toThrow();
  });
  it("accepts DONE without deadline and retains remote treatment and lifecycle", () => {
    expect(parseCieloChargebackCase({ ...fixture, treatmentDeadline: undefined, actionTakenCode: "RECUSADO", lifecycle: { action: "Em análise com Cielo", actionDate: "2026-11-01" } }, "DONE")).toMatchObject({ treatmentDeadline: "", actionTakenCode: "RECUSADO", lifecycle: { action: "Em análise com Cielo" } });
  });
  it("preserves the official optional process and currency fields without inventing defaults", () => {
    expect(parseCieloChargebackCase({ ...fixture, process: "PRIMEIRO_CHARGEBACK", transactionDetails: { ...fixture.transactionDetails, currency: "REAL" } })).toMatchObject({ process: "PRIMEIRO_CHARGEBACK", transactionDetails: { currency: "REAL" } });
    const missing = parseCieloChargebackCase(fixture);
    expect(missing).not.toHaveProperty("process");
    expect(missing.transactionDetails).not.toHaveProperty("currency");
  });
  it("rejects impossible dates, malformed identifiers and invalid money; never retains a full PAN", () => {
    for (const changes of [{ treatmentDeadline: "2026-02-31" }, { idCase: "../1" }, { transactionAmount: "1e3" }, { transactionAmount: "-1.00" }]) {
      expect(() => parseCieloChargebackCase({ ...fixture, ...changes })).toThrow();
    }
    expect(parseCieloChargebackCase({ ...fixture, transactionDetails: { ...fixture.transactionDetails, truncatedCard: "4111111111111111" } }).transactionDetails.truncatedCard).toBe("");
  });
});

describe("Cielo chargeback API", () => {
  it("requires explicit enabled environment, credentials, certificate and allowed EC", () => {
    expect(isCieloChargebackConfigured()).toBe(true);
    process.env.CIELO_CHARGEBACK_ENVIRONMENT = "prod-typo";
    expect(isCieloChargebackConfigured()).toBe(false);
    process.env.CIELO_CHARGEBACK_ENVIRONMENT = "production";
    process.env.CIELO_CHARGEBACK_ESTABLISHMENT_NUMBERS = "";
    expect(isCieloChargebackConfigured()).toBe(false);
  });
  it("uses official OAuth form/mTLS, all zero-based pages and lossless IDs", async () => {
    replies.push({ raw: JSON.stringify({ content: [fixture], last: false, number: 0 }).replace('"98765432109876543210"', "98765432109876543210") }, { body: { content: [{ ...fixture, idCase: "2", idChargeback: "3" }], last: true, number: 1 } });
    const result = await listCieloChargebacks("PENDING", { startDate: "2026-05-01", endDate: "2026-10-01" });
    expect(result).toHaveLength(2);
    expect(result[0].idChargeback).toBe(fixture.idChargeback);
    expect(requests[0]).toMatchObject({ url: "https://apihml-internet.cielo.com.br/cielo-security-sys-web-hml/oauth/v2/MulesoftHML/protocol/openid-connect/token", body: "grant_type=client_credentials&client_id=client&client_secret=secret", options: { cert: Buffer.from("pem"), key: Buffer.from("pem"), rejectUnauthorized: true } });
    expect(requests[2].url).toContain("/PENDING?page=1&pageSize=200");
    expect(JSON.parse(requests[1].body)).toMatchObject({ establishmentNumber: ["1234567890"], startNotificationPeriod: "2026-05-01", endNotificationPeriod: "2026-10-01" });
  });
  it("fetches exactly the requested page so a persistent cursor can resume without replaying old pages", async () => {
    replies.push({ body: { content: [fixture], last: false, number: 7 } });
    const page = await listCieloChargebackPage("PENDING", { startDate: "2026-11-01", endDate: "2026-11-03", page: 7 });
    expect(page).toMatchObject({ items: [{ idCase: fixture.idCase }], last: false });
    expect(requests).toHaveLength(2);
    expect(requests[1].url).toContain("PENDING?page=7&pageSize=200");
  });
  it("returns an empty final page for business103", async () => {
    replies.push({ body: { code: 103 } });
    await expect(listCieloChargebackPage("DONE", { page: 2 })).resolves.toEqual({ items: [], last: true });
  });
  it.each(["PENDING", "DONE"] as const)("treats HTTP204 as an empty final %s page", async (status) => {
    replies.push({ status: 204, raw: "" });
    await expect(listCieloChargebackPage(status, { page: 2 })).resolves.toEqual({ items: [], last: true });
  });
  it.each(["PENDING", "DONE"] as const)("stops listing %s on HTTP204 without losing previous pages", async (status) => {
    replies.push({ body: { content: [fixture], last: false, number: 0 } }, { status: 204, raw: "" });
    await expect(listCieloChargebacks(status)).resolves.toMatchObject([{ idCase: fixture.idCase }]);
    expect(requests).toHaveLength(3);
  });
  it("keeps an empty HTTP200 list response invalid", async () => {
    replies.push({ status: 200, raw: "" });
    await expect(listCieloChargebacks("PENDING")).rejects.toMatchObject({ code: "cielo_invalid_json" });
  });
  it("rejects HTTP204 authentication before querying any list", async () => {
    replies = [{ status: 204, raw: "" }];
    await expect(listCieloChargebacks("PENDING")).rejects.toMatchObject({ code: "cielo_invalid_json", uncertain: false });
    expect(requests).toHaveLength(1);
  });
  it("validates page cursors and returned pagination before advancing", async () => {
    for (const page of [-1, 0.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(listCieloChargebackPage("PENDING", { page })).rejects.toMatchObject({ code: "cielo_invalid_pagination" });
    }
    expect(requests).toHaveLength(0);
    replies.push({ body: { content: [fixture], last: false, number: 0 } });
    await expect(listCieloChargebackPage("PENDING", { page: 3 })).rejects.toMatchObject({ code: "cielo_invalid_pagination" });
  });
  it("recognizes empty code 103 and rejects HTTP200 business errors safely", async () => {
    replies.push({ body: { code: 103 } });
    expect(await listCieloChargebacks("PENDING")).toEqual([]);
    replies.push({ body: { access_token: "token" } }, { body: { code: 901, message: "sensitive upstream detail" } });
    await expect(listCieloChargebacks("PENDING")).rejects.toMatchObject({ code: "cielo_business_901", transient: true, uncertain: false });
  });
  it("marks HTTP408 reads as transient without an uncertain mutation", async () => {
    replies.push({ status: 408, body: {} });
    await expect(listCieloChargebacks("PENDING")).rejects.toMatchObject({ code: "cielo_http_408", transient: true, uncertain: false });
  });
  it("fails closed on unauthorized EC and malformed pagination", async () => {
    replies.push({ body: { content: [{ ...fixture, establishmentNumber: "2222222222" }], last: true } });
    await expect(listCieloChargebacks("PENDING")).rejects.toMatchObject({ code: "cielo_establishment_not_allowed" });
    replies.push({ body: { access_token: "token" } }, { body: { content: [fixture] } });
    await expect(listCieloChargebacks("PENDING")).rejects.toMatchObject({ code: "cielo_invalid_pagination" });
  });
  it("validates date windows before making any connection", async () => {
    await expect(listCieloChargebacks("DONE", { startDate: "2025-01-01", endDate: "2026-01-01" })).rejects.toThrow();
    await expect(listCieloChargebacks("DONE", { startDate: "2026-11-03", endDate: "2026-11-03" })).rejects.toMatchObject({ code: "cielo_invalid_date_window" });
    expect(requests).toHaveLength(0);
  });
  it("sends the sandbox-confirmed idCase filter without altering the exact identifier", async () => {
    replies.push({ body: { content: [fixture], last: true, number: 0 } });
    await expect(listCieloChargebacks("PENDING", { idCase: fixture.idCase, startDate: "2026-11-02", endDate: "2026-11-03" })).resolves.toHaveLength(1);
    const body = JSON.parse(requests[1].body);
    expect(body.idCase).toBe(fixture.idCase);
    expect(body).not.toHaveProperty("idcase");
  });
  it("rejects unrelated results when querying one case instead of inferring that case's remote state", async () => {
    replies.push({ body: { content: [{ ...fixture, idCase: "999" }], last: true, number: 0 } });
    await expect(listCieloChargebacks("DONE", { idCase: fixture.idCase, startDate: "2026-11-02", endDate: "2026-11-03" })).rejects.toMatchObject({ code: "cielo_invalid_case_filter" });
  });
  it("reads lifecycle and support document using validated paths and response codes", async () => {
    replies.push({ body: [{ action: "Em análise com Cielo", actionDate: "2026-11-01" }] });
    expect(await getCieloChargebackLifecycle(fixture.idCase)).toEqual([{ action: "Em análise com Cielo", actionDate: "2026-11-01" }]);
    replies.push({ body: { access_token: "token" } }, { body: { returncode: 105, nameFile: `${fixture.idCase}.pdf`, file: "JVBERi0=" } });
    expect(await getCieloChargebackDocument(parseCieloChargebackCase(fixture))).toMatchObject({ nameFile: `${fixture.idCase}.pdf` });
    expect(requests.at(-1)?.url).toContain(`/supportDocument/1234567890/${fixture.idChargeback}`);
  });
  it.each([200, 400, 412])("returns null only for documented no-support-document code927 on HTTP%s", async (status) => {
    replies.push({ status, body: { code: 927, message: "Case informado não possui documentação de apoio atrelada!" } });
    await expect(getCieloChargebackDocument(parseCieloChargebackCase(fixture))).resolves.toBeNull();
  });
  it("keeps unknown document failures distinct from a confirmed absent document", async () => {
    replies.push({ status: 404, body: { message: "not found" } });
    await expect(getCieloChargebackDocument(parseCieloChargebackCase(fixture))).rejects.toMatchObject({ code: "cielo_http_404" });
  });
  it("recognizes absent-document code927 inside the HTTP412 details wrapper", async () => {
    replies.push({ status: 412, body: { code: "412", message: "PRECON_FAILED", details: [{ code: "927", message: "private document details" }] } });
    await expect(getCieloChargebackDocument(parseCieloChargebackCase(fixture))).resolves.toBeNull();
  });
  it("classifies the observed nested document error901 as transient without exposing its message", async () => {
    replies.push({ status: 400, body: { errorCode: "400", errorDescription: "Bad Request", errorMessage: { code: "901", message: "private upstream detail", details: [] } } });
    await expect(getCieloChargebackDocument(parseCieloChargebackCase(fixture))).rejects.toMatchObject({ code: "cielo_business_901", message: "cielo_business_901", transient: true, uncertain: false });
  });
  it("does not infer an absent document from HTTP204", async () => {
    replies.push({ status: 204, raw: "" });
    await expect(getCieloChargebackDocument(parseCieloChargebackCase(fixture))).rejects.toMatchObject({ code: "cielo_invalid_json", uncertain: false });
  });
  it("does not infer an empty lifecycle from HTTP204", async () => {
    replies.push({ status: 204, raw: "" });
    await expect(getCieloChargebackLifecycle(fixture.idCase)).rejects.toMatchObject({ code: "cielo_invalid_json", uncertain: false });
  });
  it("rejects oversized bodies and sanitizes transport failures", async () => {
    replies.push({ raw: "x".repeat(12 * 1024 * 1024 + 1) });
    await expect(listCieloChargebacks("PENDING")).rejects.toMatchObject({ code: "cielo_response_too_large" });
    replies.push({ error: "client_secret=secret" });
    await expect(listCieloChargebacks("PENDING")).rejects.toMatchObject({ code: "cielo_transport_error", message: "cielo_transport_error", transient: true });
  });
  it.each(["sandbox", "production"])("blocks all defense submissions before any network call in %s", async (environment) => {
    process.env.CIELO_CHARGEBACK_ENVIRONMENT = environment;
    process.env.CIELO_CHARGEBACK_ENABLED = "true";
    expect(isCieloChargebackConfigured()).toBe(true);
    await expect(submitCieloChargebackDefense(parseCieloChargebackCase(fixture), Buffer.from("%PDF-test"), "Defesa"))
      .rejects.toMatchObject({ code: "cielo_human_review_required", transient: false, uncertain: false });
    expect(requests).toHaveLength(0);
  });
  it("uses production hosts only when explicitly selected", async () => {
    process.env.CIELO_CHARGEBACK_ENVIRONMENT = "production";
    replies.push({ body: { code: 103 } });
    await listCieloChargebacks("PENDING");
    expect(requests[0].url).toBe("https://api-internet.cielo.com.br/cielo-security-sys-web/oauth/v2/MulesoftPRD/protocol/openid-connect/token");
    expect(requests[1].url).toContain("https://api-internet.cielo.com.br/cielo-chargeback-sys-external/");
  });
});
