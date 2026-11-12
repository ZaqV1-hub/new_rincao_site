import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOperationsSessionToken, OPERATIONS_COOKIE_NAME } from "@/lib/ops-session";
import { POST as sale } from "./route";
import { POST as panelSale } from "@/app/api/painel/bilheteria/sales/route";
import { POST as update } from "@/app/api/ops/purchases/update/route";
import { POST as cancel } from "@/app/api/ops/purchases/cancel/route";
import { POST as panelUpdate } from "@/app/api/painel/bilheteria/purchases/update/route";
import { POST as panelCancel } from "@/app/api/painel/bilheteria/purchases/cancel/route";
import { POST as reservation } from "@/app/api/painel/bilheteria/reservations/[purchaseId]/pay/route";
const mock = vi.hoisted(() => ({ sale: vi.fn(), update: vi.fn(), cancel: vi.fn(), reservation: vi.fn() }));
vi.mock("@/lib/painel-acl", () => ({ listLegacyPanelResourcesForRole: async () => [] }));
vi.mock("@/lib/ops-box-office-sales", () => ({ createOperationalBoxOfficeSale: mock.sale, asBoxOfficeSaleError: (error: unknown) => error }));
vi.mock("@/lib/ops-purchase-management", () => ({ updateOperationalPurchase: mock.update, cancelOperationalPurchase: mock.cancel, asPurchaseOperationError: (error: unknown) => error }));
vi.mock("@/lib/painel-bilheteria", () => ({ payPainelBilheteriaReservation: mock.reservation, asPainelBilheteriaError: (error: unknown) => error }));
const session = createOperationsSessionToken({ authSource: "panel", role: "operator", legacyRoleId: 2, actorName: "Sessão", actorCpf: "52998224725", legacyResources: ["vis_bilhet"] });
const token = createOperationsSessionToken({ authSource: "token", role: "admin", legacyRoleId: 1, legacyResources: ["vis_bilhet"] });
const denied = createOperationsSessionToken({ authSource: "panel", role: "admin", legacyRoleId: 1, legacyResources: ["vis_compra"] });
const body = { agendaId: 88, periodId: 55, cpf: "52998224725", idempotencyKey: "sale-test-key", items: [{ type: "norma", quantity: 1 }], services: [{ serviceId: 9, quantity: 1 }], payments: [{ method: "dinhe", value: "110" }] };
const mutation = { purchaseId: 321, reason: "Correção", purchaseDate: "2099-01-01" };
const cases = [
  { call: sale, body }, { call: panelSale, body }, { call: update, body: mutation }, { call: cancel, body: mutation },
  { call: panelUpdate, body: mutation }, { call: panelCancel, body: mutation },
  { call: (request: Request) => reservation(request, { params: Promise.resolve({ purchaseId: "321" }) }), body: { periodId: 55, idempotencyKey: "reservation-pay-321", payments: body.payments } },
];
function request(payload: unknown, auth?: string) { return new Request("https://example.test/api/sale", { method: "POST", headers: { "Content-Type": "application/json", ...(auth ? { cookie: `${OPERATIONS_COOKIE_NAME}=${auth}` } : {}) }, body: JSON.stringify(payload) }); }
beforeEach(() => { vi.clearAllMocks(); for (const service of Object.values(mock)) service.mockResolvedValue({ purchaseId: 321 }); });
describe("cash mutations share strict panel authorization", () => {
  it("denies anonymous, legacy token and wrong-resource sessions on every route", async () => {
    for (const entry of cases) for (const [auth, status] of [[undefined, 401], [token, 401], [denied, 403]] as const) {
      const response = await entry.call(request(entry.body, auth)); expect(response.status).toBe(status); expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    for (const service of Object.values(mock)) expect(service).not.toHaveBeenCalled();
  });
  it("uses the session actor, carries explicit sale scope and rejects body impersonation", async () => {
    expect((await sale(request(body, session))).status).toBe(200);
    expect(mock.sale).toHaveBeenCalledWith({ ...body, actor: { name: "Sessão", cpf: "52998224725" } });
    for (const entry of cases) expect((await entry.call(request({ ...entry.body, actor: { name: "Impostor" } }, session))).status).toBe(400);
  });
  it("normalizes operational conflict responses with no-store", async () => {
    mock.sale.mockRejectedValue({ code: "cash_session_closed", message: "Caixa fechado.", status: 409 });
    const response = await sale(request(body, session)); expect(response.status).toBe(409); expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
