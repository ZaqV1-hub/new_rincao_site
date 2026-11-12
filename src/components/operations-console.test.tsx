import React, { type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OperationsConsole } from "./operations-console";

const harness = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0, mounted: false, effects: [] as Array<() => void> }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useEffect: (effect: () => void, dependencies: unknown[]) => { if (!harness.mounted && dependencies.length === 0) harness.effects.push(effect); },
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.values)) harness.values[index] = typeof initial === "function" ? initial() : initial;
    return [harness.values[index], (next: unknown) => { harness.values[index] = typeof next === "function" ? next(harness.values[index]) : next; }];
  },
}));
type Props = { children?: ReactNode; disabled?: boolean; onClick?: () => void | Promise<void> };
function nodes(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!React.isValidElement<Props>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join("");
  return React.isValidElement<Props>(node) ? text(node.props.children) : String(node ?? "");
}
function render() {
  harness.cursor = 0;
  const tree = OperationsConsole({ embedded: true, visibleSections: ["operations"] });
  harness.mounted = true;
  return tree;
}
function button(name: string) {
  return nodes(render()).find(node => node.type === "button" && text(node.props.children) === name)!;
}
const summary = { period: { id: 7, openedAt: "2026-11-11", closedAt: null, operator: null, closureSheetId: null }, funds: [], sangrias: [], totals: { fund: "0.00", sangria: "0.00", cashSales: "10.00", cashInDrawer: "10.00" } };
const closure = { id: 9, periodId: 7, operator: "Gestor", openedAt: "2026-11-11", closedAt: "2026-11-12", totals: { cash: "10.00", fund: "0.00", overall: "10.00" }, snapshot: { period: { ini: "2026-11-11", fim: "2026-11-12" } } };

describe("operations console cash transition", () => {
  beforeEach(() => { harness.values = []; harness.cursor = 0; harness.mounted = false; harness.effects = []; });
  afterEach(() => vi.unstubAllGlobals());
  it("directs sales and admissions to explicit cash sessions and preserves legacy history", () => {
    const html = renderToStaticMarkup(<OperationsConsole embedded visibleSections={["operations"]} />);
    expect(html).toContain('href="/painel/caixas"');
    expect(html).toContain('href="/painel/bilheteria/historico"');
    expect(html).toContain("Historico de fechamentos");
    expect(html).not.toContain("Validar por numero");
    expect(html).not.toContain("Registrar venda de bilheteria");
    expect(html).not.toContain("Vouchers JSON");
    expect(html).not.toContain("reposiciona o caixa");
  });
  it.each(["Fechar caixa", "Fechar pendencias"])("handles %s without expecting a successor or fetching a global summary again", async (action) => {
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/ops/session") return Response.json({ ok: true, data: { authenticated: true, actorName: "Gestor", actorCpf: null, role: "admin", permissions: ["ops.read", "ops.cash"] } });
      if (url === "/api/ops/cash-summary") return Response.json({ ok: true, data: summary });
      if (init?.method === "POST") return Response.json({ ok: true, data: { closure, nextPeriodId: null, currentSummary: null, closedCount: 1 } });
      return Response.json({ ok: true, data: { items: [closure], meta: { total: 1, limit: 10, offset: 0 } } });
    });
    vi.stubGlobal("fetch", fetch);
    render();
    for (const effect of harness.effects) effect();
    await vi.waitFor(() => expect(button("Atualizar").props.disabled).toBe(false));
    await button("Atualizar").props.onClick!();
    await vi.waitFor(() => expect(text(render())).toContain("Periodo #7"));
    await button(action).props.onClick!();
    await vi.waitFor(() => expect(text(render())).toContain("Nenhum caixa legado carregado"));
    expect(text(render())).toContain("Fechamento #9");
    expect(button("Fechar caixa").props.disabled).toBe(true);
    expect(fetch.mock.calls.filter(([url]) => url === "/api/ops/cash-summary")).toHaveLength(1);
    const command = fetch.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(String(command[1]!.body))).not.toHaveProperty("actor");
    expect(JSON.parse(String(command[1]!.body))).not.toHaveProperty("operatorName");
  });
});
