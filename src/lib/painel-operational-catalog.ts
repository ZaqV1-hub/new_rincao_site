import type { PoolClient } from "pg";
import { getIngressoSistemaDbDialect, getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import { ensureOpsAuditLogTable } from "@/lib/ops-audit-log";
import { opsErrorResponse, readJsonPayload, readRouteActor } from "@/lib/ops-route-utils";
import type { LegacyPanelResource } from "@/lib/painel-access";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export type CatalogActor = { name: string | null; cpf: string | null };

export class OperationalCatalogError extends Error {
  constructor(readonly code: "invalid_input" | "version_conflict" | "duplicate_name", message: string) {
    super(message);
  }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function readCatalogInput(input: unknown, extraFields: readonly string[] = []) {
  if (!isRecord(input) ||
    Object.keys(input).some((key) => !["name", "description", "active", "id", "version", ...extraFields].includes(key))) {
    throw new OperationalCatalogError("invalid_input", "Dados do cadastro inválidos.");
  }
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : null;
  const { active, id, version } = input;
  if (!name || name.length > 120 || name.includes("\0") ||
    description === null || description.length > 1000 || description.includes("\0") || typeof active !== "boolean") {
    throw new OperationalCatalogError("invalid_input", "Informe nome (até 120 caracteres), descrição (até 1000) e status ativo.");
  }

  if ("id" in input || "version" in input) {
    if (!isPositiveInteger(id) || !isPositiveInteger(version)) {
      throw new OperationalCatalogError("invalid_input", "Informe um identificador e uma versão positivos.");
    }
    return { record: input, name, description, active, edit: { id, version } };
  }
  return { record: input, name, description, active, edit: null };
}

export function catalogId(value: string) {
  const id = Number(value);
  if (!isPositiveInteger(id)) throw new Error("Identificador do catálogo fora do intervalo seguro.");
  return id;
}

export function requireCatalogRow<T>(rows: T[]): T {
  if (!rows[0]) {
    throw new OperationalCatalogError("version_conflict", "Este cadastro mudou ou não está disponível. Atualize a lista e tente novamente.");
  }
  return rows[0];
}

export function getOperationalCatalogPool() {
  if (getIngressoSistemaDbDialect() !== "postgres") {
    throw new Error("O catálogo operacional requer PostgreSQL.");
  }
  return getIngressoSistemaDbPool();
}

export async function withOperationalCatalogTransaction<T>(run: (client: PoolClient) => Promise<T>) {
  const client = await getOperationalCatalogPool().connect();
  let discard = false;
  try {
    // Prepare the shared audit table before BEGIN so a failed write cannot roll back its initialization.
    await ensureOpsAuditLogTable(client, "postgres");
    await client.query("BEGIN");
    try {
      const result = await run(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        discard = true;
      }
      throw error;
    }
  } finally {
    client.release(discard);
  }
}

type OperationalCatalog = {
  resource: LegacyPanelResource;
  list: () => Promise<unknown>;
  save: (input: unknown, actor: CatalogActor) => Promise<unknown>;
};

function privateResponse(response: Response) {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function runPainelCatalogRoute(
  request: Request,
  catalog: OperationalCatalog,
  method: "GET" | "POST" | "PATCH",
) {
  try {
    const access = await requirePainelApiAccess(request, catalog.resource);
    if (!access.ok) return privateResponse(access.response);
    if (method === "GET") return privateResponse(Response.json({ ok: true, data: await catalog.list() }));
    if (access.session.legacyRoleId !== 1) {
      return privateResponse(opsErrorResponse("painel_forbidden", "Apenas gerentes podem alterar este cadastro.", 403));
    }

    if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      throw new OperationalCatalogError("invalid_input", "Envie os dados do cadastro em JSON.");
    }
    const input = await readJsonPayload<unknown>(request);
    if (!isRecord(input) ||
      (method === "POST" ? "id" in input || "version" in input : !("id" in input && "version" in input))) {
      throw new OperationalCatalogError("invalid_input", "Dados do cadastro inválidos para esta operação.");
    }
    const actor = readRouteActor({ name: access.session.actorName, cpf: access.session.actorCpf });
    const data = await catalog.save(input, actor);
    return privateResponse(Response.json({ ok: true, data }, { status: method === "POST" ? 201 : 200 }));
  } catch (error) {
    if (error instanceof OperationalCatalogError) {
      return privateResponse(opsErrorResponse(error.code, error.message, error.code === "invalid_input" ? 400 : 409));
    }
    console.error("[painel-catalog]", catalog.resource, error instanceof Error ? error.name : "Unknown error");
    return privateResponse(opsErrorResponse("catalog_unavailable", "Não foi possível acessar o cadastro.", 500));
  }
}
