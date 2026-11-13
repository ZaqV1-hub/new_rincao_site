import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PainelCompraDetailActions } from "./painel-compra-detail-actions";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const callbacks = { onBusyChange: () => {}, onOperationComplete: () => {} };
describe("purchase voucher actions", () => {
  it("lets readers print only the selection without offering operational mutations", () => {
    const html = renderToStaticMarkup(<PainelCompraDetailActions purchaseId={8} voucherIds={[3, 9]} canOperate={false} {...callbacks} />);
    expect(html).toContain("voucherIds=3%2C9");
    expect(html).toContain("Imprimir selecionados");
    expect(html).not.toContain("Validar selecionados");
    expect(html).not.toContain("Solicitar envio por WhatsApp");
    expect(html).not.toContain("voucherIds=8");
  });
  it("does not turn an empty selection into printing the whole purchase", () => {
    const html = renderToStaticMarkup(<PainelCompraDetailActions purchaseId={8} voucherIds={[]} canOperate {...callbacks} />);
    expect(html).not.toContain("/imprimir");
    expect(html).toContain("Selecione os vouchers");
    expect(html).toContain("Selecione o caixa");
    expect(html).toContain("Conferi o telefone");
    expect(html).toContain("disabled");
    expect(html).not.toContain("enviados com sucesso");
  });
});
