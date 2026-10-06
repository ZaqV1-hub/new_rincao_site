import { NextResponse } from "next/server";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import {
  createEnfermariaRecord,
  listEnfermariaDashboard,
  listEnfermariaLocais,
  listEnfermariaRecords,
  listEnfermariaClientTrips,
  saveEnfermariaLocal,
  searchEnfermariaClients,
  searchEnfermariaDayUse,
  type EnfermariaSource,
} from "@/lib/enfermaria";

export const runtime = "nodejs";

function localToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function responseError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { message } }, { status, headers: { "cache-control": "private, no-store" } });
}

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "private, no-store" } });
}

export async function GET(request: Request) {
  const access = await requirePainelApiAccess(request, "vis_enfermaria");
  if (!access.ok) return access.response;
  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? "";

  try {
    if (action === "clients") {
      return privateJson({ ok: true, data: await searchEnfermariaClients(url.searchParams.get("q") ?? "") });
    }
    if (action === "trips") {
      return privateJson({ ok: true, data: await listEnfermariaClientTrips(Number(url.searchParams.get("clientId"))) });
    }
    if (action === "day-use") {
      return privateJson({ ok: true, data: await searchEnfermariaDayUse(url.searchParams.get("cpf") ?? "") });
    }
    if (action === "locals") {
      return privateJson({ ok: true, data: await listEnfermariaLocais(true) });
    }
    if (action === "records") {
      const filters = Object.fromEntries(url.searchParams.entries());
      return privateJson({ ok: true, data: await listEnfermariaRecords(filters) });
    }
    if (action === "dashboard") {
      const from = url.searchParams.get("from") ?? localToday();
      const to = url.searchParams.get("to") ?? from;
      return privateJson({ ok: true, data: await listEnfermariaDashboard(from, to) });
    }
    return responseError("Ação de consulta desconhecida.");
  } catch {
    return responseError("Não foi possível carregar os dados da Enfermaria.", 500);
  }
}

export async function POST(request: Request) {
  const access = await requirePainelApiAccess(request, "vis_enfermaria");
  if (!access.ok) return access.response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return responseError("Envie dados válidos.");
  const actor = access.session.actorName ?? access.session.actorCpf ?? "Enfermaria";
  try {
    if (body.action === "create") {
      const source = body.source as EnfermariaSource;
      if (!["cliente", "day_use", "sem_cadastro"].includes(source)) return responseError("Escolha um vínculo válido.");
      if (source === "sem_cadastro" && !String(body.initialName ?? "").trim()) return responseError("Informe quem é a pessoa ou o grupo.");
      const id = await createEnfermariaRecord({
        source,
        clientId: body.clientId ? Number(body.clientId) : null,
        clientName: String(body.clientName ?? ""),
        buyerName: String(body.buyerName ?? ""),
        visitDate: String(body.visitDate ?? ""),
        ticketCount: Number(body.ticketCount ?? 0),
        ticketSummary: String(body.ticketSummary ?? ""),
        tripId: body.tripId ? Number(body.tripId) : null,
        purchaseId: body.purchaseId ? Number(body.purchaseId) : null,
        buyerCpf: body.buyerCpf ? String(body.buyerCpf) : null,
        initialName: String(body.initialName ?? ""),
        intakeSource: String(body.intakeSource ?? ""),
        guardianCpf: String(body.guardianCpf ?? ""),
        guardianPhone: String(body.guardianPhone ?? ""),
        noAccountReason: String(body.noAccountReason ?? ""),
        professional: access.session.actorName ?? "",
        occurredAt: String(body.occurredAt ?? new Date().toISOString()),
        actor,
      });
      return privateJson({ ok: true, data: { id } }, 201);
    }
    if (body.action === "local") {
      if (access.session.legacyRoleId !== 1) return responseError("Somente gerente pode gerenciar locais.", 403);
      const id = await saveEnfermariaLocal({ name: String(body.name ?? ""), actor });
      return privateJson({ ok: true, data: { id } }, 201);
    }
    return responseError("Ação desconhecida.");
  } catch (error) {
    return responseError(error instanceof Error && error.message.startsWith("Informe") ? error.message : "Não foi possível abrir o atendimento.", 400);
  }
}

export async function PATCH(request: Request) {
  const access = await requirePainelApiAccess(request, "vis_enfermaria");
  if (!access.ok) return access.response;
  if (access.session.legacyRoleId !== 1) return responseError("Somente gerente pode gerenciar locais.", 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || body.action !== "local") return responseError("Ação desconhecida.");
  try {
    const id = await saveEnfermariaLocal({ id: Number(body.id), name: String(body.name ?? ""), active: Boolean(body.active), actor: access.session.actorName ?? "Gerente" });
    return privateJson({ ok: true, data: { id } });
  } catch (error) {
    return responseError(error instanceof Error ? error.message : "Não foi possível salvar o local.", 400);
  }
}
