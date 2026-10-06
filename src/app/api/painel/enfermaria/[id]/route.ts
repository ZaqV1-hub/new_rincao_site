import { NextResponse } from "next/server";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import {
  addEnfermariaClientObservation,
  auditEnfermariaAction,
  closeEnfermariaRecord,
  getEnfermariaRecord,
  linkEnfermariaClient,
  listEnfermariaHistory,
  unlockEnfermariaRecord,
  updateEnfermariaRecord,
  verifyEnfermariaManagerPassword,
} from "@/lib/enfermaria";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { message } }, { status, headers: { "cache-control": "private, no-store" } });
}

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "private, no-store" } });
}

export async function GET(request: Request, context: Context) {
  const access = await requirePainelApiAccess(request, "vis_enfermaria");
  if (!access.ok) return access.response;
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return errorResponse("Atendimento inválido.");
  try {
    const [record, history] = await Promise.all([getEnfermariaRecord(id), listEnfermariaHistory(id)]);
    if (!record) return errorResponse("Atendimento não encontrado.", 404);
    return privateJson({ ok: true, data: { record, history } });
  } catch {
    return errorResponse("Não foi possível carregar a ficha.", 500);
  }
}

export async function PATCH(request: Request, context: Context) {
  const access = await requirePainelApiAccess(request, "vis_enfermaria");
  if (!access.ok) return access.response;
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !Number.isInteger(id) || id <= 0) return errorResponse("Dados inválidos.");
  const actor = access.session.actorName ?? access.session.actorCpf ?? "Enfermaria";
  try {
    const record = await updateEnfermariaRecord(id, {
      form: body.form && typeof body.form === "object" ? body.form as Record<string, unknown> : {},
      occurredAt: String(body.occurredAt ?? "").trim(),
      localId: body.localId ? Number(body.localId) : null,
      actor,
    });
    return privateJson({ ok: true, data: record });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Não foi possível salvar a ficha.", 400);
  }
}

export async function POST(request: Request, context: Context) {
  const access = await requirePainelApiAccess(request, "vis_enfermaria");
  if (!access.ok) return access.response;
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !Number.isInteger(id) || id <= 0) return errorResponse("Dados inválidos.");
  const actor = access.session.actorName ?? access.session.actorCpf ?? "Enfermaria";
  try {
    if (body.action === "close") {
      return privateJson({ ok: true, data: await closeEnfermariaRecord(id, actor) });
    }
    if (body.action === "unlock") {
      if (access.session.legacyRoleId !== 1) return errorResponse("Somente gerente pode liberar a edição.", 403);
      const cpf = String(body.cpf ?? access.session.actorCpf ?? "");
      if (!await verifyEnfermariaManagerPassword(cpf, String(body.password ?? ""))) return errorResponse("Senha de gerente inválida.", 401);
      return privateJson({ ok: true, data: await unlockEnfermariaRecord(id, actor) });
    }
    if (body.action === "link-client") {
      if (access.session.legacyRoleId !== 1) return errorResponse("Somente gerente pode vincular o atendimento.", 403);
      return privateJson({ ok: true, data: await linkEnfermariaClient(id, Number(body.clientId), actor) });
    }
    if (body.action === "observation") {
      if (access.session.legacyRoleId !== 1) return errorResponse("Somente gerente pode adicionar observações ao cliente.", 403);
      const record = await getEnfermariaRecord(id);
      if (!record?.clientId) return errorResponse("O atendimento ainda não está vinculado a um cliente.");
      await addEnfermariaClientObservation(record.clientId, String(body.text ?? ""), actor);
      await auditEnfermariaAction(id, "observacao_cliente", actor);
      return privateJson({ ok: true });
    }
    return errorResponse("Ação desconhecida.");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Não foi possível concluir a ação.", 400);
  }
}
