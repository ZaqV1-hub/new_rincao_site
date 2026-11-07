import { request } from "node:https";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { CieloChargebackCase } from "./chargeback-contract";

export type { CieloChargebackCase } from "./chargeback-contract";

export class CieloChargebackError extends Error {
  constructor(public readonly code: string, public readonly transient = false, public readonly uncertain = false) {
    super(code);
    this.name = "CieloChargebackError";
  }
}

function invalid(field: string): never { throw new CieloChargebackError(`cielo_invalid_${field}`); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid("response");
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 1000): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
  if (typeof value !== "string" || value.length > max) return invalid("field");
  return value.trim();
}
function identifier(value: unknown, max = 20): string {
  const result = text(value, max);
  if (!new RegExp(`^\\d{1,${max}}$`).test(result)) return invalid("identifier");
  return result;
}
function date(value: unknown, required = false): string {
  const result = text(value, 10);
  if (!result && !required) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result)) || new Date(result).toISOString().slice(0, 10) !== result) return invalid("date");
  return result;
}

// Tokenize strings first so numeric identifiers and decimal amounts never pass through IEEE-754.
export function parseChargebackJson(source: string): unknown {
  try {
    JSON.parse(source);
    return JSON.parse(source.replace(/"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[\da-fA-F]{4}))*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
      (token) => token.startsWith('"') ? token : JSON.stringify(token)));
  } catch { return invalid("json"); }
}

export function parseCieloChargebackCase(payload: unknown, status: "PENDING" | "DONE" = "PENDING"): CieloChargebackCase {
  const item = record(payload);
  const tx = record(item.transactionDetails);
  const details = record(item.chargebackDetails);
  const amount = typeof item.transactionAmount === "number" && Number.isFinite(item.transactionAmount) ? String(item.transactionAmount) : text(item.transactionAmount, 18);
  if (!/^\d{1,15}(?:\.\d{1,2})?$/.test(amount)) return invalid("amount");
  const card = text(tx.truncatedCard, 30);
  const result: CieloChargebackCase = {
    idCase: identifier(item.idCase), idChargeback: identifier(item.idChargeback), establishmentNumber: identifier(item.establishmentNumber, 10),
    treatmentDeadline: date(item.treatmentDeadline, status === "PENDING"), transactionAmount: amount, remoteStatus: status,
    transactionDetails: {
      tid: text(tx.tid, 40), nsu: text(tx.nsu, 20), authorization: text(tx.authorization, 20),
      transactionDate: date(tx.transactionDate), truncatedCard: /^[\d*xX .-]+$/.test(card) && /[*xX]/.test(card) && card.replace(/\D/g, "").length <= 10 ? card : "", cardAssociationName: text(tx.cardAssociationName, 50),
    },
    chargebackDetails: { reasonCode: text(details.reasonCode, 20), reasonDescription: text(details.reasonDescription, 1000) },
  };
  if (item.process != null) result.process = text(item.process, 50);
  if (tx.currency != null) result.transactionDetails.currency = text(tx.currency, 64);
  if (details.reasonMessage != null) result.chargebackDetails.reasonMessage = text(details.reasonMessage, 100);
  if (details.receptionDate) result.chargebackDetails.receptionDate = date(details.receptionDate);
  if (details.replyDate) result.chargebackDetails.replyDate = date(details.replyDate);
  if (item.actionTakenCode) result.actionTakenCode = text(item.actionTakenCode, 50);
  if (item.lifecycle && record(item.lifecycle).action) {
    const lifecycle = record(item.lifecycle);
    result.lifecycle = { action: text(lifecycle.action, 100), actionDate: date(lifecycle.actionDate) };
  }
  return result;
}

function getConfig() {
  const env = (key: string) => process.env[`CIELO_CHARGEBACK_${key}`]?.trim() ?? "";
  const environment = env("ENVIRONMENT");
  const clientId = env("CLIENT_ID"), clientSecret = env("CLIENT_SECRET"), certPath = env("CERT_PATH"), keyPath = env("KEY_PATH"), userEmail = env("USER_EMAIL");
  const establishments = env("ESTABLISHMENT_NUMBERS").split(",").map((value) => value.trim()).filter(Boolean);
  if (env("ENABLED") !== "true" || !["sandbox", "production"].includes(environment) || !clientId || !clientSecret || !certPath || !keyPath || !establishments.length || establishments.some((value) => !/^\d{10}$/.test(value)) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail) || userEmail.length > 256) {
    throw new CieloChargebackError("cielo_chargeback_not_configured");
  }
  const production = environment === "production";
  const host = production ? "https://api-internet.cielo.com.br" : "https://apihml-internet.cielo.com.br";
  return { clientId, clientSecret, certPath, keyPath, passphrase: env("KEY_PASSPHRASE") || undefined, userEmail, establishments,
    api: `${host}/cielo-chargeback-sys-${production ? "external" : "sandbox"}/chargeback/v1/`,
    tokenUrl: `${host}/cielo-security-sys-web${production ? "" : "-hml"}/oauth/v2/Mulesoft${production ? "PRD" : "HML"}/protocol/openid-connect/token` };
}
export function isCieloChargebackConfigured(): boolean {
  try { getConfig(); return true; } catch { return false; }
}
type Config = ReturnType<typeof getConfig>;
function allowed(config: Config, establishment: string) {
  if (!config.establishments.includes(establishment)) throw new CieloChargebackError("cielo_establishment_not_allowed");
}

// Only documented validation rejections prove that a defense was not accepted.
const rejectedBusinessCodes = ["138", "902", "903", "904", "905", "906", "907", "908", "909", "910", "911", "912", "913", "914", "915", "916", "917", "919", "920", "921", "922", "923", "924", "925", "926", "927", "928", "929", "930", "932", "933", "934", "935", "936", "938", "939", "941"];

function responseErrorCode(payload: unknown): string {
  const data = record(payload);
  const wrappers = [data];
  if (data.errorMessage && typeof data.errorMessage === "object" && !Array.isArray(data.errorMessage)) wrappers.push(record(data.errorMessage));
  for (const wrapper of wrappers) {
    for (const candidate of [wrapper, ...(Array.isArray(wrapper.details) ? wrapper.details : [])]) {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
      const item = record(candidate);
      const code = text(item.code ?? item.returncode ?? item.codigo, 10);
      if (rejectedBusinessCodes.includes(code) || ["901", "918", "931"].includes(code)) return code;
    }
  }
  return "";
}

async function exchange(config: Config, url: string, method: string, body: string | Buffer | undefined, contentType: string, token?: string, mutation = false, allowNoContent = false): Promise<unknown> {
  let cert: Buffer, key: Buffer;
  try { [cert, key] = await Promise.all([readFile(config.certPath), readFile(config.keyPath)]); }
  catch { throw new CieloChargebackError("cielo_certificate_unavailable"); }
  return new Promise((resolve, reject) => {
    let settled = false;
    let sent = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fail = (code: string, transient = false, uncertain = mutation && sent) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new CieloChargebackError(code, transient, uncertain));
    };
    try {
      const req = request(new URL(url), { method, cert, key, passphrase: config.passphrase, rejectUnauthorized: true, minVersion: "TLSv1.2", headers: {
        Accept: "application/json", "Content-Type": contentType,
        ...(body === undefined ? {} : { "Content-Length": Buffer.byteLength(body) }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      } }, (response) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 12 * 1024 * 1024) { fail("cielo_response_too_large"); req.destroy(); return; }
          chunks.push(chunk);
        });
        response.on("error", () => fail("cielo_transport_error", true));
        response.on("aborted", () => fail("cielo_transport_error", true));
        response.on("end", () => {
          if (settled) return;
          const status = response.statusCode ?? 0;
          if (status < 200 || status >= 300) {
            let errorCode = "";
            try {
              errorCode = responseErrorCode(parseChargebackJson(Buffer.concat(chunks).toString("utf8")));
            } catch { /* Non-JSON error bodies retain their HTTP classification. */ }
            if (errorCode) {
              fail(`cielo_business_${errorCode}`, ["901", "918"].includes(errorCode), mutation && !rejectedBusinessCodes.includes(errorCode)); return;
            }
            fail(`cielo_http_${status}`, status === 408 || status === 429 || status >= 500, mutation && (status >= 500 || status === 408)); return;
          }
          if (status === 204 && allowNoContent) {
            settled = true; clearTimeout(timer); resolve(undefined); return;
          }
          try {
            const parsed = parseChargebackJson(Buffer.concat(chunks).toString("utf8"));
            settled = true; clearTimeout(timer); resolve(parsed);
          } catch { fail("cielo_invalid_json"); }
        });
      });
      req.on("error", () => fail("cielo_transport_error", true));
      timer = setTimeout(() => { fail("cielo_timeout", true); req.destroy(); }, 30_000);
      sent = true;
      req.end(body);
    } catch { fail("cielo_transport_error", true); }
  });
}

async function apiRequest(config: Config, method: string, path: string, body?: string | Buffer, mutation = false, session: { token?: string; expiresAt?: number } = {}, allowNoContent = false, contentType = "application/json") {
  if (!session.token || (session.expiresAt ?? 0) <= Date.now()) {
    const auth = record(await exchange(config, config.tokenUrl, "POST", new URLSearchParams({ grant_type: "client_credentials", client_id: config.clientId, client_secret: config.clientSecret }).toString(), "application/x-www-form-urlencoded"));
    if (typeof auth.access_token !== "string" || !auth.access_token || /[\r\n]/.test(auth.access_token)) throw new CieloChargebackError("cielo_invalid_token");
    session.token = auth.access_token;
    const expires = Number(auth.expires_in ?? 300);
    if (!Number.isFinite(expires) || expires <= 0) throw new CieloChargebackError("cielo_invalid_token");
    session.expiresAt = Date.now() + Math.max(0, Math.min(expires, 300) - 30) * 1000;
  }
  return exchange(config, config.api + path, method, body, contentType, session.token, mutation, allowNoContent);
}
function businessCode(payload: unknown, allowedCodes: string[] = [], mutation = false): string {
  if (Array.isArray(payload)) return "";
  const data = record(payload);
  const code = responseErrorCode(payload) || text(data.code ?? data.returncode ?? data.codigo, 10);
  if (code && !allowedCodes.includes(code)) throw new CieloChargebackError(`cielo_business_${/^\d{3}$/.test(code) ? code : "unknown"}`, ["901", "918"].includes(code), mutation && !rejectedBusinessCodes.includes(code));
  return code;
}

type ListOptions = { startDate?: string; endDate?: string; idCase?: string };

async function readChargebackPage(status: "PENDING" | "DONE", options: ListOptions & { page: number }, config: Config, session = {}) {
  if (status !== "PENDING" && status !== "DONE") return invalid("status");
  const { page } = options;
  if (!Number.isSafeInteger(page) || page < 0) return invalid("pagination");
  const start = date(options.startDate), end = date(options.endDate);
  if (Boolean(start) !== Boolean(end) || (start && (start >= end || Date.parse(end) - Date.parse(start) > 180 * 86_400_000))) return invalid("date_window");
  const idCase = options.idCase === undefined ? undefined : identifier(options.idCase);
  const body = JSON.stringify({ establishmentNumber: config.establishments, ...(start ? { startNotificationPeriod: start, endNotificationPeriod: end } : {}), ...(idCase ? { idCase } : {}) });
  const payload = await apiRequest(config, "POST", `${status}?page=${page}&pageSize=200&orderBy=receptionDate&Order=asc`, body, false, session, true);
  if (payload === undefined) return { items: [], last: true };
  if (businessCode(payload, ["103"]) === "103") return { items: [], last: true };
  const data = record(payload);
  if (!Array.isArray(data.content) || typeof data.last !== "boolean" || (data.number !== undefined && Number(data.number) !== page) || (!data.last && !data.content.length)) return invalid("pagination");
  const ids = new Set<string>();
  const items = data.content.map((raw) => {
    const item = parseCieloChargebackCase(raw, status);
    allowed(config, item.establishmentNumber);
    if (idCase && item.idCase !== idCase) return invalid("case_filter");
    const key = `${item.establishmentNumber}:${item.idCase}`;
    if (ids.has(key)) return invalid("pagination");
    ids.add(key);
    return item;
  });
  return { items, last: data.last };
}

export async function listCieloChargebackPage(status: "PENDING" | "DONE", options: ListOptions & { page: number }): Promise<{ items: CieloChargebackCase[]; last: boolean }> {
  return readChargebackPage(status, options, getConfig());
}

export async function listCieloChargebacks(status: "PENDING" | "DONE", options: ListOptions = {}): Promise<CieloChargebackCase[]> {
  const config = getConfig();
  const result: CieloChargebackCase[] = [];
  const ids = new Set<string>();
  const session = {};
  for (let page = 0; page < 10_000; page++) {
    const data = await readChargebackPage(status, { ...options, page }, config, session);
    for (const item of data.items) {
      const key = `${item.establishmentNumber}:${item.idCase}`;
      if (ids.has(key)) return invalid("pagination");
      ids.add(key); result.push(item);
    }
    if (data.last) return result;
  }
  return invalid("pagination_limit");
}

export async function getCieloChargebackLifecycle(idCase: string): Promise<unknown> {
  const id = identifier(idCase);
  const payload = await apiRequest(getConfig(), "GET", `lifecycle/${id}`);
  businessCode(payload);
  if (!Array.isArray(payload)) return invalid("lifecycle");
  return payload.map((entry) => { const item = record(entry); return { action: text(item.action, 100), actionDate: date(item.actionDate) }; });
}

export async function getCieloChargebackDocument(chargeback: CieloChargebackCase): Promise<unknown> {
  const config = getConfig();
  const ec = identifier(chargeback.establishmentNumber, 10), id = identifier(chargeback.idChargeback);
  allowed(config, ec);
  let payload: unknown;
  try { payload = await apiRequest(config, "GET", `supportDocument/${ec}/${id}`); }
  catch (error) {
    if (error instanceof CieloChargebackError && error.code === "cielo_business_927") return null;
    throw error;
  }
  const code = businessCode(payload, ["104", "105", "927"]);
  if (code === "927") return null;
  const data = record(payload);
  if (!code || typeof data.file !== "string" || !data.file) return invalid("document");
  return { nameFile: text(data.nameFile, 50), file: data.file, dateInclusion: date(data.dateInclusion), returncode: code };
}

export async function submitCieloChargebackDefense(chargeback: CieloChargebackCase, pdf: Buffer, reason: string): Promise<unknown> {
  const config = getConfig();
  const item = parseCieloChargebackCase(chargeback, chargeback.remoteStatus);
  allowed(config, item.establishmentNumber);
  if (item.remoteStatus !== "PENDING") return invalid("case_status");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (item.treatmentDeadline < today) throw new CieloChargebackError("cielo_deadline_expired");
  if (!reason.trim() || reason.length > 100 || /[\r\n\u0000]/.test(reason)) return invalid("reason");
  if (!Buffer.isBuffer(pdf) || pdf.length > 8_000_000 || pdf.subarray(0, 5).toString() !== "%PDF-") return invalid("pdf");
  // shortcut: internal renderer PDFs use uncompressed page dictionaries; reject unsupported PDFs until a parser is needed.
  const pages = pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length ?? 0;
  if (pages < 1 || pages > 10 || !pdf.subarray(-1024).toString("latin1").includes("%%EOF")) return invalid("pdf");
  const boundary = `cielo-${randomUUID()}`;
  const fields = { establishmentNumber: item.establishmentNumber, idChargeback: item.idChargeback, reasonToRefuse: reason.trim(), userName: config.userEmail };
  const body = Buffer.concat([
    ...Object.entries(fields).map(([name, value]) => Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`)),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${item.idCase}.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
    pdf, Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const payload = await apiRequest(config, "PUT", "refuse", body, true, {}, false, `multipart/form-data; boundary=${boundary}`);
  let code: string;
  try { code = businessCode(payload, ["102"], true); }
  catch (error) {
    if (error instanceof CieloChargebackError && error.code.startsWith("cielo_business_")) throw error;
    throw new CieloChargebackError("cielo_unconfirmed_submission", false, true);
  }
  if (code !== "102") throw new CieloChargebackError("cielo_unconfirmed_submission", false, true);
  return { code, message: "Chargeback recusado com sucesso!" };
}
