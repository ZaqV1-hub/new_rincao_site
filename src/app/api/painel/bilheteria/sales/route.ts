import {
  asBoxOfficeSaleError,
  createOperationalBoxOfficeSale,
} from "@/lib/ops-box-office-sales";
import { readJsonPayload } from "@/lib/ops-route-utils";
import { runPainelBilheteriaRoute } from "@/lib/painel-bilheteria-route";

export const runtime = "nodejs";

type BoxOfficeSalePayload = {
  agendaId?: unknown;
  cpf?: unknown;
  items?: unknown;
  courtesies?: unknown;
  payments?: unknown;
  purchaseDiscountId?: unknown;
  reason?: unknown;
  idempotencyKey?: unknown;
};

export async function POST(request: Request) {
  return runPainelBilheteriaRoute(
    request,
    {
      params: Promise.resolve({}),
    },
    {
      readPayload: (currentRequest) =>
        readJsonPayload<BoxOfficeSalePayload>(currentRequest),
      run: async ({ payload, actor }) =>
        createOperationalBoxOfficeSale({
          agendaId: Number(payload?.agendaId),
          cpf: typeof payload?.cpf === "string" ? payload.cpf : null,
          items: Array.isArray(payload?.items)
            ? (payload.items as Array<{
                type: string;
                quantity: number;
                discountId?: number | null;
                label?: string | null;
              }>)
            : [],
          purchaseDiscountId:
            Number.isInteger(Number(payload?.purchaseDiscountId)) &&
            Number(payload?.purchaseDiscountId) > 0
              ? Number(payload?.purchaseDiscountId)
              : null,
          courtesies: Array.isArray(payload?.courtesies)
            ? (payload.courtesies as Array<{
                authorId: number;
                authorizedById?: number | null;
                quantity: number;
                identification?: string | null;
                note?: string | null;
              }>)
            : [],
          payments: Array.isArray(payload?.payments)
            ? (payload.payments as Array<{
                method: string;
                value: string | number;
              }>)
            : [],
          reason: typeof payload?.reason === "string" ? payload.reason : "",
          idempotencyKey:
            typeof payload?.idempotencyKey === "string"
              ? payload.idempotencyKey
              : null,
          actor,
        }),
      mapError: asBoxOfficeSaleError,
      logTag: "painel-bilheteria-sales-failed",
    },
  );
}
