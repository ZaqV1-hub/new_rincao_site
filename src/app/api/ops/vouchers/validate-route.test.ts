import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./validate/route";
import { createOperationsSessionToken, OPERATIONS_COOKIE_NAME } from "@/lib/ops-session";
import { VoucherOperationError } from "@/lib/ops-voucher-validation-contract";
const mock = vi.hoisted(() => ({
  validateVoucherByNumber: vi.fn(),
  validatePurchaseVouchers: vi.fn(),
  validateSchoolTripVouchers: vi.fn(),
  validateSelectedVouchers: vi.fn(),
}));
vi.mock("@/lib/ops-voucher-validation", () => ({ ...mock, asVoucherOperationError: (error: Error) => error }));
vi.mock("@/lib/painel-acl", () => ({ listLegacyPanelResourcesForRole: async () => [] }));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => { throw new Error("Unexpected database access"); } }));
const actor = { name: "Operador confiável", cpf: "00000000001" };
const session = createOperationsSessionToken({ authSource:"panel",role:"operator",legacyRoleId:3,legacyResources:["vis_bilhet"],actorName:actor.name,actorCpf:actor.cpf });
function request(body: unknown, cookie: string | null = session) { return new Request("https://example.test/api/ops/vouchers/validate", { method:"POST",headers:{"content-type":"application/json",authorization:"Bearer legacy-token",...(cookie ? {cookie:`${OPERATIONS_COOKIE_NAME}=${cookie}`} : {})},body:JSON.stringify(body) }); }
beforeEach(() => { vi.clearAllMocks(); for (const fn of Object.values(mock)) fn.mockResolvedValue({action:"validate",processedCount:1}); });
describe("validate voucher routes with explicit cash", () => {

  it("passes all four targets, explicit cash and trusted actor", async () => {
    for (const [body, name, args] of [
      [{voucherNumber:"A1234"}, "validateVoucherByNumber", ["A1234",false,actor,11]],
      [{purchaseId:321,confirm:true}, "validatePurchaseVouchers", [321,true,actor,11]],
      [{schoolId:77,agendaId:88}, "validateSchoolTripVouchers", [77,88,actor,11]],
      [{voucherIds:[9001,9002]}, "validateSelectedVouchers", [[9001,9002],actor,11]],
    ] as const) {
      const response = await POST(request({...body,periodId:11,actor:{name:"Forged",cpf:"99999999999"}}));
      expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(mock[name]).toHaveBeenCalledWith(...args);
    }
  });

  it("rejects missing cash without inferring the only open session", async () => {
    const response=await POST(request({voucherIds:[1]}));
    expect(response.status).toBe(409); expect(await response.json()).toMatchObject({error:{code:"cash_session_required"}});
    for (const fn of Object.values(mock)) expect(fn).not.toHaveBeenCalled();
  });
  it("rejects legacy token, absent session and missing ACL", async () => {
    const token=createOperationsSessionToken({authSource:"token",role:"admin",legacyRoleId:1,legacyResources:["vis_bilhet"]});
    const denied=createOperationsSessionToken({authSource:"panel",role:"operator",legacyRoleId:3,legacyResources:["vis_agenda"]});
    for (const [cookie,status] of [[null,401],[token,401],[denied,403]] as const) {
      const response=await POST(request({voucherIds:[1],periodId:11},cookie));
      expect(response.status).toBe(status); expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    for (const fn of Object.values(mock)) expect(fn).not.toHaveBeenCalled();
  });
  it("keeps payload errors and explicit operational conflicts", async () => {
    expect((await POST(request({periodId:11}))).status).toBe(400);
    expect((await POST(request({voucherIds:[-1],periodId:11}))).status).toBe(400);
    expect((await POST(request({voucherIds:[1],periodId:"11"}))).status).toBe(409);
    mock.validateSelectedVouchers.mockRejectedValueOnce(new VoucherOperationError("voucher_cash_closed","Fechado",409));
    const response=await POST(request({voucherIds:[1],periodId:11}));
    expect(response.status).toBe(409); expect(await response.json()).toMatchObject({error:{code:"voucher_cash_closed"}});
  });
});
