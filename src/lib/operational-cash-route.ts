import { CashSessionError } from "@/lib/operational-cash-session";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import type { CatalogActor } from "@/lib/painel-operational-catalog";
import { opsErrorResponse, readJsonPayload, readRouteActor } from "@/lib/ops-route-utils";

function privateResponse(response: Response) { response.headers.set("Cache-Control", "private, no-store"); return response; }
export function invalidCashRequest(): never { throw new CashSessionError("invalid_input", "Dados do caixa inválidos.", 400); }
export function cashQuery(request: Request, allowed: string[] = []) {
  const query = new URL(request.url).searchParams;
  if ([...query.keys()].some((key) => !allowed.includes(key) || query.getAll(key).length !== 1)) invalidCashRequest();
  return query;
}
export async function cashPeriodId(context: { params: Promise<{ periodId: string }> }) {
  const { periodId } = await context.params;
  if (!/^[1-9]\d*$/.test(periodId) || !Number.isSafeInteger(Number(periodId))) invalidCashRequest();
  return Number(periodId);
}
export async function readCashCommand<T>(request: Request, keys: string[]): Promise<T> {
  cashQuery(request);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") invalidCashRequest();
  const data = await readJsonPayload<unknown>(request);
  if (!data || typeof data !== "object" || Array.isArray(data) || Object.keys(data).some((key) => !keys.includes(key))) invalidCashRequest();
  // The domain validates values; the route rejects actor, park and period overrides.
  return data as T;
}
export async function runCashSessionRoute(request: Request, run: (actor: CatalogActor) => Promise<Response>) {
  try {
    const access = await requirePainelApiAccess(request, "vis_bilhet");
    if (!access.ok) return privateResponse(access.response);
    return privateResponse(await run(readRouteActor({ name: access.session.actorName, cpf: access.session.actorCpf })));
  } catch (error) {
    if (error instanceof CashSessionError) return privateResponse(opsErrorResponse(error.code, error.message, error.status));
    console.error("[painel-cash]", error instanceof Error ? error.name : "Unknown error");
    return privateResponse(opsErrorResponse("cash_unavailable", "Não foi possível acessar o caixa.", 503));
  }
}
