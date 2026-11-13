import {beforeEach,describe,expect,it,vi} from "vitest";
import {sendPurchaseTicketsWhatsApp,readOperationalTicketWhatsappStatus} from "./ticket-service-whatsapp";
const mock=vi.hoisted(()=>({request:vi.fn(),auth:vi.fn(),website:vi.fn(),selected:vi.fn()}));
vi.mock("./ticket-service-transport",()=>({ticketRequest:mock.request,authenticate:mock.auth,websiteTicketRequest:mock.website}));
vi.mock("./ticket-service-config",()=>({getConfig:()=>({testing:true}),digitsOnly:(v:string)=>String(v??"").replace(/\D/g,""),validateWhatsappPhoneForEnvironment:()=>true,isWebsiteTicketApiTesting:()=>true,isRetryableTicketServiceError:()=>false}));
vi.mock("./ticket-purchase-eligibility",()=>({loadConfirmedPurchase:async()=>({idcompra:1,tpcompra:"ponli",dtcompra:"2026-11-13",cpf:"",celular:""})}));
vi.mock("./ticket-service-queries",()=>({loadSelectedTicketVouchers:mock.selected}));
const requestId="a45d602e-ea91-4ac3-ab2c-c403f7547c5f";
describe("operational ticket resend",()=>{
 beforeEach(()=>{vi.clearAllMocks();mock.auth.mockResolvedValue("token");mock.selected.mockResolvedValue([{idvoucher:2,tpvoucher:"norma"}]);});
 it("uses the authenticated durable receiver and verifies acceptance of the exact selection",async()=>{
  mock.request.mockResolvedValue({ok:true,vouchers:[{voucherId:"2",status:"accepted"}]});
  expect(await sendPurchaseTicketsWhatsApp(1,[2],"5511999999999",requestId)).toMatchObject({status:"sent",sentVoucherIds:[2],upstreamStatus:200});
  expect(mock.request).toHaveBeenCalledWith(expect.any(Object),"/tickets/resend",expect.objectContaining({requestId,orderId:"1",useTestDb:true}),"token",[200,207]);
  expect(mock.website).not.toHaveBeenCalled();
 });
 it("does not treat a partial, ambiguous or foreign response as acceptance",async()=>{
  for(const vouchers of [[],[{voucherId:"3",status:"accepted"}],[{voucherId:"2",status:"ambiguous"}],[{voucherId:"2",status:"accepted"},{voucherId:"2",status:"accepted"}]]) {
   mock.request.mockResolvedValue({ok:true,vouchers});
   await expect(sendPurchaseTicketsWhatsApp(1,[2],"5511999999999",requestId)).rejects.toThrow("ticket_resend_uncertain");
  }
 });
 it("refuses a changed source selection before dispatch",async()=>{
  await expect(sendPurchaseTicketsWhatsApp(1,[2,3],"5511999999999",requestId)).resolves.toMatchObject({status:"skipped",skippedReason:"voucher_selection_unavailable"});
  expect(mock.request).not.toHaveBeenCalled();
 });
 it("queries durable status without dispatch and only resolves complete, unambiguous selections",async()=>{
  for(const [rows,expected] of [
   [[{voucherId:"2",status:"accepted"}],"accepted"],
   [[{voucherId:"2",status:"failed"}],"failed"],
   [[{voucherId:"2",status:"ambiguous"}],null],
   [[],null],
  ] as const) {
   mock.request.mockResolvedValue({ok:true,vouchers:rows});
   expect(await readOperationalTicketWhatsappStatus(requestId,1,[2])).toBe(expected);
  }
  expect(mock.request.mock.calls.every(call=>call[1]==="/tickets/resend/status")).toBe(true);
 });
});
