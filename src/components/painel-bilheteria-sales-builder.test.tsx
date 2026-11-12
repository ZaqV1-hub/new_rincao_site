import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { PainelBilheteriaSalesBuilder } from "./painel-bilheteria-sales-builder";
import { saleCommandStorageKey, saleDraftStorageKey } from "@/lib/painel-bilheteria-sales";
import { prepareStoredCashCommand } from "@/lib/cash-command-client";
import type { PublicAgendaEvent } from "@/lib/agenda-contracts";
import { DEFAULT_B2C_PRODUCTS, type B2cProduct } from "@/lib/b2c-catalog-defaults";
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], index: 0, effects: [] as (() => void)[], push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: hooks.push }) }));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), useMemo: (run: () => unknown) => run(), useEffect: (run: () => void) => hooks.effects.push(run), useSyncExternalStore: () => true,
  useState: (initial: unknown) => { const index = hooks.index++; if (!(index in hooks.slots)) hooks.slots[index] = typeof initial === "function" ? initial() : initial; return [hooks.slots[index], (next: unknown) => { hooks.slots[index] = typeof next === "function" ? next(hooks.slots[index]) : next; }]; },
}));
type Node = React.ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Node[] { if (Array.isArray(value)) return value.flatMap(nodes); if (!React.isValidElement(value)) return []; return [value as Node, ...nodes((value as Node).props.children)]; }
function plain(value: unknown): string { return Array.isArray(value) ? value.map(plain).join(" ") : React.isValidElement(value) ? plain((value as Node).props.children) : typeof value === "string" ? value : ""; }
function find(tree: unknown, predicate: (node: Node) => boolean) { const result = nodes(tree).find(predicate); if (!result) throw new Error("Element absent"); return result; }
const products: B2cProduct[] = [...DEFAULT_B2C_PRODUCTS, { ...DEFAULT_B2C_PRODUCTS[0], id: "servico:7", type: "addon", voucherType: "espec", operationalServiceId: 7, title: "Armário", sitePrice: "", boxOfficePrice: "10.00" }];
const memory = new Map<string, string>();
function render() { hooks.index = 0; return PainelBilheteriaSalesBuilder({ periodId: 4, today: "2099-01-01", agendas: [{ id: 2, date: "2099-01-01" }] as PublicAgendaEvent[], products }); }
const click = (node: Node) => (node.props.onClick as () => void)();
const change = (node: Node, value: string) => (node.props.onChange as (event: unknown) => void)({ target: { value } });
beforeEach(() => { hooks.slots = []; hooks.effects = []; hooks.index = 0; hooks.push.mockClear(); memory.clear(); vi.stubGlobal("window", {}); vi.stubGlobal("sessionStorage", { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key) }); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ok: true, data: { discounts: [], courtesyAuthors: [] } }))); });
it("persists gate-only services separately without discounts and requires CPF", () => {
  click(find(render(), (node) => node.type === "button" && plain(node).includes("Nova linha")));
  let tree = render(); change(find(tree, (node) => node.type === "select" && plain(node).includes("Armário")), "servico:7");
  tree = render(); const discount = find(tree, (node) => node.type === "select" && plain(node).includes("Este item não aceita desconto")); expect(discount.props.disabled).toBe(true);
  click(find(tree, (node) => node.type === "button" && plain(node) === "Finalizar compra")); expect(hooks.push).not.toHaveBeenCalled();
  tree = render(); change(find(tree, (node) => node.props["aria-label"] === "CPF do comprador"), "529.982.247-25");
  click(find(render(), (node) => node.type === "button" && plain(node) === "Finalizar compra"));
  expect(hooks.push).toHaveBeenCalledWith("/painel/bilheteria/finalizar?periodId=4");
  expect(JSON.parse(memory.get(saleDraftStorageKey(4))!)).toMatchObject({ periodId: 4, cpf: "52998224725", items: [], services: [{ serviceId: 7, quantity: 1, label: "Armário", totalValue: "10.00" }], totalValue: "10.00" });
});
it("blocks another cart while this period has an unresolved attempt", () => {
  prepareStoredCashCommand(saleCommandStorageKey(4), { periodId: 4, cpf: "52998224725" });
  const tree = render(); expect(find(tree, (node) => node.type === "a").props.href).toBe("/painel/bilheteria/finalizar?periodId=4"); expect(nodes(tree).some((node) => node.type === "input")).toBe(false);
});
it("enforces the 500-unit total across multiple rows", () => {
  let tree = render(); change(find(tree, (node) => node.props["aria-label"] === "CPF do comprador"), "52998224725");
  for (let i = 0; i < 2; i++) { click(find(render(), (node) => node.type === "button" && plain(node).includes("Nova linha"))); tree = render(); change(find(tree, (node) => node.type === "select" && node.props.value === "" && plain(node).includes("Armário")), "servico:7"); }
  tree = render(); for (const node of nodes(tree).filter((node) => node.type === "input" && node.props.type === "number")) change(node, "500");
  click(find(render(), (node) => node.type === "button" && plain(node) === "Finalizar compra"));
  expect(hooks.push).not.toHaveBeenCalled(); expect(plain(render())).toContain("Limite de 500 unidades");
});
