import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import { applyPurchaseBatch, previewPurchaseBatch } from "@/lib/operational-purchase-batch";
import { PurchaseBatchError, invalidPurchaseBatch } from "@/lib/operational-purchase-batch-contract";
import { dispatchPurchaseBatchEmail, listPurchaseBatchEmail } from "@/lib/operational-purchase-batch-email";

export const runtime = "nodejs";
function privateResponse(response: Response) { response.headers.set("Cache-Control","private, no-store"); return response; }
async function body(request: Request) {
  if (new URL(request.url).search || request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json" ||
    Number(request.headers.get("content-length")) > 65536 || !request.body) return invalidPurchaseBatch();
  const reader = request.body.getReader(), decoder = new TextDecoder("utf-8",{ fatal: true });
  let bytes = 0, value = "";
  try {
    while (true) { const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.byteLength; if (bytes > 65536) return invalidPurchaseBatch(); value += decoder.decode(chunk.value,{ stream: true }); }
    return JSON.parse(value + decoder.decode()) as unknown;
  } catch { await reader.cancel().catch(() => undefined); return invalidPurchaseBatch(); }
  finally { reader.releaseLock(); }
}
async function run(request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    const access = await requirePainelApiAccess(request,"vis_compra");
    if (!access.ok) return privateResponse(access.response);
    if (!access.legacyResources.includes("vis_bilhet")) throw new PurchaseBatchError("batch_forbidden","Permissão de bilheteria obrigatória para alterar compras.",403);
    const { action } = await context.params;
    const actor = { name: access.session.actorName,cpf: access.session.actorCpf };
    if (request.method === "GET") {
      if (action !== "email" || new URL(request.url).search) return invalidPurchaseBatch();
      return privateResponse(Response.json({ ok: true,data: await listPurchaseBatchEmail(actor) }));
    }
    if (!["preview","apply","email"].includes(action)) return invalidPurchaseBatch();
    const input = await body(request);
    let result;
    if (action === "email") {
      if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => key !== "batchId")) return invalidPurchaseBatch();
      result = await dispatchPurchaseBatchEmail((input as { batchId?: unknown }).batchId,actor);
    } else result = action === "preview" ? await previewPurchaseBatch(input) : await applyPurchaseBatch(input,actor);
    return privateResponse(Response.json({ ok: true,data: result }));
  } catch (error) {
    const known = error instanceof PurchaseBatchError;
    return privateResponse(Response.json({ ok: false,error: { code: known ? error.code : "batch_unavailable",
      message: known ? error.message : "Não foi possível confirmar o lote. Consulte a mesma tentativa antes de iniciar outra." } },{ status: known ? error.status : 503 }));
  }
}
export const POST = run;
export const GET = run;
