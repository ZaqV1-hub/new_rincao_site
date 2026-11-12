import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { PainelBilheteriaHistoryEditor } from "./painel-bilheteria-history-editor";
import type { PainelBilheteriaPurchaseDetail } from "@/lib/painel-bilheteria";

const harness = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0, replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: harness.replace, refresh: harness.refresh }) }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useMemo: (calculate: () => unknown) => calculate(),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.values)) harness.values[index] = typeof initial === "function" ? initial() : initial;
    return [harness.values[index], (next: unknown) => { harness.values[index] = typeof next === "function" ? next(harness.values[index]) : next; }];
  },
}));
type Props = { children?: ReactNode; value?: unknown; href?: string; disabled?: boolean; onClick?: () => void | Promise<void>; onChange?: (event: { target: { value: string } }) => void };
function nodes(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!React.isValidElement<Props>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join("");
  return React.isValidElement<Props>(node) ? text(node.props.children) : String(node ?? "");
}
const detail: PainelBilheteriaPurchaseDetail = { purchaseId: 7, purchaseDate: "2026-11-12", cpf: "", type: "bilhe", typeLabel: "Bilheteria", status: "conc", statusLabel: "Concluída", paymentMethod: "dinhe", paymentMethodLabel: "Dinheiro", totalValue: "0.00", paidAt: null, vouchers: [], payments: [], discountOptions: [], payableReservation: false };
function render() {
  harness.cursor = 0;
  return PainelBilheteriaHistoryEditor({ detail, actorName: "Body actor", actorCpf: "123", paymentOptions: [{ value: "dinhe", label: "Dinheiro" }] });
}
function button(tree: ReactNode, name: string) {
  return nodes(tree).find(node => node.type === "button" && text(node.props.children) === name)!;
}
async function save() {
  let tree = render();
  nodes(tree).find(node => node.type === "input" && node.props.value === "")!.props.onChange!({ target: { value: "52998224725" } });
  nodes(tree).find(node => node.type === "textarea")!.props.onChange!({ target: { value: "Correção do CPF" } });
  tree = render();
  await button(tree, "Salvar alteracoes").props.onClick!();
  tree = render();
  await button(tree, "Sim, salvar").props.onClick!();
  await vi.waitFor(() => expect(button(render(), "Salvando...")).toBeUndefined());
  return render();
}
describe("historical purchase editor", () => {
  beforeEach(() => { harness.values = []; harness.cursor = 0; vi.clearAllMocks(); });
  afterEach(() => vi.unstubAllGlobals());
  it("submits no actor and reads the current API success envelope", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true, data: { message: "Atualizada", warnings: ["Aviso"] } }));
    vi.stubGlobal("fetch", fetch);
    await save();
    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body).toMatchObject({ purchaseId: 7, cpf: "52998224725", reason: "Correção do CPF" });
    expect(body).not.toHaveProperty("actor");
    expect(harness.replace).toHaveBeenCalledWith("/painel/bilheteria/historico/7?success=Atualizada&warning=Aviso");
  });
  it("keeps financial history read-only after the server rejects an adjustment", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ok: false, error: { code: "purchase_financial_adjustment_required", message: "Ajuste financeiro necessário" } }, { status: 409 }));
    vi.stubGlobal("fetch", fetch);
    const tree = await save();
    expect(tree.type).toBe("fieldset");
    expect(tree.props.disabled).toBe(true);
    expect(nodes(tree).some(node => node.props.href === "/painel/caixas")).toBe(true);
    expect(nodes(tree).some(node => node.props.href === "/painel/bilheteria/historico/7")).toBe(true);
    expect(nodes(tree).some(node => node.type === "input" && node.props.value === "52998224725")).toBe(true);
    expect(harness.replace).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
