import React, { type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PainelBilheteriaWorkstation } from "@/components/painel-bilheteria-workstation";

const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useEffect: () => undefined,
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = typeof initial === "function" ? initial() : initial;
    return [hooks.values[index], (next: unknown) => { hooks.values[index] = typeof next === "function" ? next(hooks.values[index]) : next; }];
  },
}));
beforeEach(() => { hooks.values = []; hooks.cursor = 0; });
afterEach(() => vi.unstubAllGlobals());
type NodeProps = { children?: ReactNode; placeholder?: string; "aria-label"?: string; onClick?: () => void; onChange?: (event: { target: { value: string } }) => void; onSubmit?: (event: { preventDefault: () => void }) => void | Promise<void> };
function nodes(node: ReactNode): ReactElement<NodeProps>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!React.isValidElement<NodeProps>(node)) return [];
  return [node, ...nodes(node.props.children)];
}

describe("PainelBilheteriaWorkstation", () => {
  it("renders the main validation and lookup areas", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelBilheteriaWorkstation, {
        actorName: "Operador Teste",
        actorCpf: "52998224725",
      }),
    );

    expect(html).toContain("Validação via Voucher");
    expect(html).toContain("Validação via Dados do Cliente");
    expect(html).toContain("Consultar Ingresso");
    expect(html).toContain("Voucher");
    expect(html).toContain("RG ou CPF");
    expect(html).toContain("Inserir ID ou número do ingresso");
    expect(html).toContain("Imprimir QR-Code");
    expect(html).toContain("Enviar no WhatsApp");
    expect(html).not.toContain("/painel/bilheteria?consult=1");
  });
});

describe("cash context and validation metadata", () => {
  it("keeps action links in the selected cash session", () => {
    const html = renderToStaticMarkup(<PainelBilheteriaWorkstation periodId={7} isManager />);
    for (const tab of ["sale", "movement", "closure"]) expect(html).toContain(`href="/painel/caixas/7?tab=${tab}"`);
    expect(html).toContain('href="/painel/bilheteria/historico?periodId=7"');
    expect(html).not.toContain('href="/painel/bilheteria/vendas"');
    expect(html).not.toContain('href="/painel/bilheteria/fechamento-caixa"');
  });
  it("directs cashier mutations to explicit session selection when none is available", () => {
    const html = renderToStaticMarkup(<PainelBilheteriaWorkstation isManager />);
    expect(html.match(/href="\/painel\/caixas"/g)?.length).toBeGreaterThanOrEqual(4);
    expect(html).not.toContain("?periodId="); expect(html).not.toContain("/caixas/null");
  });
  it("shows actual location, Sao Paulo timestamp and actor for a used ticket", () => {
    const html = renderToStaticMarkup(<PainelBilheteriaWorkstation initialTicketLookupState={{ isOpen: true, lookup: "9", error: null, result: {
      lookup: "9", voucherId: 9, purchaseId: 3, purchaseDate: "2099-01-01", usedDate: "2099-01-02", used: true,
      validationLocationName: "Portaria 2", validatedAt: "2099-01-02T15:04:05Z", validatedByName: "Operadora Maria",
    } }} />);
    expect(html).toContain("Portaria 2"); expect(html).toContain("Operadora Maria"); expect(html).toContain("02/01/2099, 12:04:05"); expect(html).toContain('dateTime="2099-01-02T15:04:05Z"');
  });
  it("does not invent attribution for a legacy used ticket", () => {
    const html = renderToStaticMarkup(<PainelBilheteriaWorkstation actorName="Operador atual" initialTicketLookupState={{ isOpen: true, lookup: "9", error: null, result: {
      lookup: "9", voucherId: 9, purchaseId: 3, purchaseDate: "2099-01-01", usedDate: "2099-01-02", used: true,
    } }} />);
    expect(html).toContain("Local, horário e operador da validação não registrados."); expect(html).not.toContain("Validado por:"); expect(html).not.toContain("Local da validação:");
  });
});

describe("ticket lookup navigation", () => {
  it.each([
    { periodId: 7, cashSessionId: undefined, expectedId: 7 },
    { periodId: null, cashSessionId: 8, expectedId: 8 },
    { periodId: 7, cashSessionId: 8, expectedId: 8 },
  ])("preserves cash $expectedId for lookup and server-modal close", ({ periodId, cashSessionId, expectedId }) => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    const tree = PainelBilheteriaWorkstation({ periodId, cashSessionId, initialTicketLookupState: { isOpen: true, lookup: " A&B /9 ", result: null, error: null } });
    const form = nodes(tree).find(node => node.type === "form" && nodes(node).some(child => child.props.placeholder === "ID ou número do ingresso"))!;
    const preventDefault = vi.fn();
    form.props.onSubmit!({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenLastCalledWith(`/painel/caixas/${expectedId}?tab=consultation&ingresso=A%26B%20%2F9`);
    nodes(tree).find(node => node.props["aria-label"] === "Fechar consulta de ingresso")!.props.onClick!();
    expect(assign).toHaveBeenLastCalledWith(`/painel/caixas/${expectedId}?tab=consultation`);
  });
  it("retains read-only action navigation without granting a mutation period", () => {
    const html = renderToStaticMarkup(<PainelBilheteriaWorkstation cashSessionId={8} periodId={null} isManager />);
    for (const tab of ["sale", "movement", "closure"]) expect(html).toContain(`href="/painel/caixas/8?tab=${tab}"`);
    expect(html).toContain('href="/painel/bilheteria/historico?periodId=8"');
    expect(html).toContain("Consultas disponíveis. Para validar ou desvalidar ingressos");
  });
  it("does not use the navigation-only ID to authorize voucher validation", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const render = () => { hooks.cursor = 0; return PainelBilheteriaWorkstation({ cashSessionId: 8, periodId: null }); };
    let tree = render();
    let form = nodes(tree).find(node => node.type === "form" && nodes(node).some(child => child.props.children === "Validação via Voucher"))!;
    nodes(form).find(node => node.type === "input")!.props.onChange!({ target: { value: "A123" } });
    tree = render();
    form = nodes(tree).find(node => node.type === "form" && nodes(node).some(child => child.props.children === "Validação via Voucher"))!;
    await form.props.onSubmit!({ preventDefault: vi.fn() });
    tree = render();
    nodes(tree).find(node => node.type === "button" && node.props.children === "Validar ingresso")!.props.onClick!();
    expect(fetch).not.toHaveBeenCalled();
    expect(nodes(render()).some(node => node.props.children === "Selecione um caixa aberto para validar ingressos.")).toBe(true);
  });
  it("preserves legacy navigation when no cash context was provided", () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    const tree = PainelBilheteriaWorkstation({ initialTicketLookupState: { isOpen: true, lookup: "9", result: null, error: null } });
    const form = nodes(tree).find(node => node.type === "form" && nodes(node).some(child => child.props.placeholder === "ID ou número do ingresso"))!;
    form.props.onSubmit!({ preventDefault: vi.fn() });
    expect(assign).toHaveBeenLastCalledWith("/painel/bilheteria?ingresso=9");
    nodes(tree).find(node => node.props["aria-label"] === "Fechar consulta de ingresso")!.props.onClick!();
    expect(assign).toHaveBeenLastCalledWith("/painel/bilheteria");
  });
});
