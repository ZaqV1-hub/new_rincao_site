import { beforeEach, describe, expect, it, vi } from "vitest";
import { lookupPainelBilheteriaTicketByVoucherId } from "./painel-bilheteria-workstation";
import { isPainelBilheteriaPurchasePaymentSettled, isPainelBilheteriaVoucherVisibleForValidation } from "./painel-bilheteria-validation";
const mock = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => mock }));
beforeEach(() => vi.clearAllMocks());
describe("voucher admission lookup metadata", () => {
  it("returns the recorded location, actor name and instant without actor CPF", async () => {
    mock.query.mockResolvedValueOnce({ rows: [{ idvoucher: 1, idcompra: 2, dtuso: "2026-11-12", hruso: "09:12:13", validacao_periodo_id: 7,
      validacao_local_nome: "Portaria", validado_em: "2026-11-12 12:12:13+00", validado_por_nome: "Operador", validado_por_cpf: "99999999999" }] });
    const result = await lookupPainelBilheteriaTicketByVoucherId("1");
    expect(result).toMatchObject({ used: true, usedDate: "2026-11-12", usedTime: "09:12:13", validationPeriodId: 7,
      validationLocationName: "Portaria", validatedAt: "2026-11-12T12:12:13.000Z", validatedByName: "Operador" });
    expect(JSON.stringify(result)).not.toContain("99999999999");
    expect(mock.query.mock.calls[0][0]).toContain("caixa_periodos");
  });
  it("leaves absent legacy location/instant/actor unknown", async () => {
    mock.query.mockResolvedValueOnce({ rows: [{ idvoucher: 1, dtuso: "2026-11-12" }] });
    expect(await lookupPainelBilheteriaTicketByVoucherId("1")).toMatchObject({ used: true, validationPeriodId: null, validationLocationName: null, validatedAt: null, validatedByName: null });
  });
  it("allows confirmed box-office services but does not treat unknown purchase types as settled", () => {
    const paid = { purchaseTypeCode: "bilhe", statusCode: "conc", paymentMethodCode: null };
    expect(isPainelBilheteriaVoucherVisibleForValidation(paid, { voucherTypeCode: "espec" })).toBe(true);
    expect(isPainelBilheteriaPurchasePaymentSettled({ ...paid, purchaseTypeCode: "unknown" })).toBe(false);
    expect(isPainelBilheteriaPurchasePaymentSettled({ ...paid, statusCode: "canc" })).toBe(false);
  });
});
