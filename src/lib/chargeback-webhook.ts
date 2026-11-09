import { createHash } from "node:crypto";
import { recordChargebackNotification } from "@/lib/chargeback-repository";
import { parseChargebackJson } from "@/lib/cielo-chargeback";
import productionAddresses from "@/lib/cielo-chargeback-production-ips.json";

type WebhookKind = "notification" | "lifecycle";
const maxBodyBytes = 64 * 1024;
const maxBatchItems = 100;
// Production egress addresses supplied by Cielo support on 2026-11-09.
const cieloProductionAddresses = new Set(productionAddresses);

function response(status: number) {
  return Response.json(
    { ok: status === 200 },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function readBody(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const bytes = new Uint8Array(maxBodyBytes);
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, size));
      if (size + value.byteLength > maxBodyBytes) {
        void reader.cancel().catch(() => {});
        return null;
      }
      bytes.set(value, size);
      size += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
}

function identifier(value: unknown, pattern: RegExp) {
  return typeof value === "string" && pattern.test(value) ? value : null;
}

export async function handleChargebackWebhook(request: Request, kind: WebhookKind) {
  if (process.env.CIELO_CHARGEBACK_ENABLED?.trim() !== "true") return response(404);

  const establishments = (process.env.CIELO_CHARGEBACK_ESTABLISHMENT_NUMBERS ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  if (establishments.length === 0 ||
      establishments.some((value) => !/^\d{10}$/.test(value))) return response(503);

  // IIS overwrites this header with REMOTE_ADDR on every proxy request. Node must
  // remain loopback-only; never substitute client-controlled forwarding headers.
  const source = request.headers.get("x-rincao-remote-address")?.replace(/^::ffff:/i, "");
  if (!source || !cieloProductionAddresses.has(source)) return response(403);

  const mediaType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json") return response(415);
  if (!request.body) return response(400);

  let data: unknown;
  try {
    const body = await readBody(request.body);
    if (body === null) return response(413);
    data = parseChargebackJson(body);
  } catch {
    return response(400);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return response(400);

  const root = data as Record<string, unknown>;
  let items: unknown[] = [root];
  if (Object.hasOwn(root, "content")) {
    if (kind !== "notification" || !Array.isArray(root.content) || root.content.length === 0 ||
        ["idCase", "idcase", "caseId", "idChargeback", "establishmentNumber"].some((key) => Object.hasOwn(root, key))) return response(400);
    if (root.content.length > maxBatchItems) return response(413);
    items = root.content;
  }

  const events: Parameters<typeof recordChargebackNotification>[0][] = [];
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return response(400);
    const payload = item as Record<string, unknown>;
    const establishmentNumber = identifier(payload.establishmentNumber, /^\d{10}$/);
    const caseValue = kind === "notification" ? payload.idCase :
      Object.hasOwn(payload, "idcase") ? payload.idcase : payload.caseId;
    const idCase = identifier(caseValue, /^\d{1,20}$/);
    const idChargeback = identifier(payload.idChargeback, /^\d{1,20}$/);
    if (!establishmentNumber || !idCase || (kind === "notification" && !idChargeback) ||
        ["idCase", "idcase", "caseId"].some((key) => Object.hasOwn(payload, key) && payload[key] !== idCase)) return response(400);
    if (!establishments.includes(establishmentNumber)) return response(403);

    // Locator and transition fields distinguish updates without storing callback data.
    const fields = kind === "notification"
      ? [idChargeback, payload.treatmentDeadline, payload.process]
      : [payload.message, payload.executionDate, payload.ActionCicleDate];
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(fields.map((value) => typeof value === "string" ? value : null)))
      .digest("hex");
    events.push({ kind, establishmentNumber, idCase, fingerprint });
  }

  try {
    // Validate the whole batch first; durable event keys make partial-write retries safe.
    for (const event of events) await recordChargebackNotification(event);
    return response(200);
  } catch {
    return response(503);
  }
}
