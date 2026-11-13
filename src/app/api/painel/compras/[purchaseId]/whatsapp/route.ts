import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import { OperationalVoucherWhatsappError, sendOperationalVoucherWhatsapp } from "@/lib/operational-voucher-whatsapp";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 512 * 1024;
function privateResponse(response: Response) { response.headers.set("Cache-Control", "private, no-store"); return response; }
function invalid(): never { throw new OperationalVoucherWhatsappError("whatsapp_invalid_input", "Envie os dados válidos em JSON, sem parâmetros adicionais.", 400); }
async function readBody(request: Request) {
  if (new URL(request.url).search || request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json" ||
    Number(request.headers.get("Content-Length")) > MAX_BODY_BYTES || !request.body) return invalid();
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let total = 0, text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > MAX_BODY_BYTES) { await reader.cancel(); return invalid(); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text) as unknown;
  } catch { return invalid(); }
  finally { reader.releaseLock(); }
}
export async function POST(request: Request, context: { params: Promise<{ purchaseId: string }> }) {
  try {
    const access = await requirePainelApiAccess(request,"vis_compra");
    if (!access.ok) return privateResponse(access.response);
    const actionAccess = await requirePainelApiAccess(request,"vis_bilhet");
    if (!actionAccess.ok) return privateResponse(actionAccess.response);
    const { purchaseId } = await context.params;
    if (!/^[1-9]\d*$/.test(purchaseId) || !Number.isSafeInteger(Number(purchaseId))) return invalid();
    const data = await sendOperationalVoucherWhatsapp(Number(purchaseId),await readBody(request),{ name: access.session.actorName, cpf: access.session.actorCpf });
    return privateResponse(Response.json({ ok: true, data }));
  } catch (error) {
    if (error instanceof OperationalVoucherWhatsappError) return privateResponse(Response.json({ ok: false,error: { code: error.code,message: error.message } },{ status: error.status }));
    return privateResponse(Response.json({ ok: false,error: { code: "whatsapp_unavailable",message: "Não foi possível consultar esta solicitação. Preserve a chave e consulte a mesma tentativa." } },{ status: 503 }));
  }
}
