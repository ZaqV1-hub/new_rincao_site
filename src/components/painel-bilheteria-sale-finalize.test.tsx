import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { PainelBilheteriaSaleFinalize, CashPaymentFields } from "./painel-bilheteria-sale-finalize";
import { PainelBilheteriaReservationPayment } from "./painel-bilheteria-reservation-payment";
import { saleCommandStorageKey, saleDraftStorageKey, type PainelBilheteriaSaleDraft } from "@/lib/painel-bilheteria-sales";
import type { PainelBilheteriaPurchaseDetail } from "@/lib/painel-bilheteria";
import { readStoredCashCommand } from "@/lib/cash-command-client";
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], index: 0 }));
vi.mock("react", async (importOriginal) => ({ ...await importOriginal<typeof import("react")>(), useSyncExternalStore: () => true,
  useState: (initial: unknown) => { const index = hooks.index++; if (!(index in hooks.slots)) hooks.slots[index] = typeof initial === "function" ? initial() : initial;
    return [hooks.slots[index], (value: unknown) => { hooks.slots[index] = typeof value === "function" ? value(hooks.slots[index]) : value; }]; },
}));
const memory = new Map<string, string>(), fetchMock = vi.fn();
type Node = React.ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!React.isValidElement(value)) return [];
  const node = value as Node; return [node, ...nodes(node.props.children)];
}
function find(tree: unknown, predicate: (node: Node) => boolean) { const node = nodes(tree).find(predicate); if (!node) throw new Error("Missing UI element"); return node; }
function plain(value: unknown): string { return Array.isArray(value) ? value.map(plain).join(" ") : React.isValidElement(value) ? plain((value as Node).props.children) : typeof value === "string" || typeof value === "number" ? String(value) : ""; }
const text = (node: Node) => plain(node.props.children);
function render(closed = false) { hooks.index = 0; return PainelBilheteriaSaleFinalize({ periodId: 9, readOnly: closed }); }
async function confirm(tree: unknown) { await (find(tree, (node) => node.type === "button" && /Confirmar pagamento|Conferir tentativa anterior/.test(text(node))).props.onClick as () => Promise<void>)(); await vi.waitFor(() => expect(hooks.slots[3]).toBe(false)); }
const draft: PainelBilheteriaSaleDraft = { periodId: 9, agendaId: 2, agendaLabel: "Hoje", cpf: "52998224725", items: [{ type: "norma", quantity: 1, label: "Adulto", discountId: null, discountLabel: null, baseUnitValue: "100.00", unitValue: "100.00", totalValue: "100.00" }], services: [], courtesies: [], totalValue: "100.00", subtotalValue: "100.00", discountValue: "0.00", reason: "Venda", createdAt: "now" };
beforeEach(() => {
  hooks.slots = []; hooks.index = 0; memory.clear(); fetchMock.mockReset();
  vi.stubGlobal("window", {}); vi.stubGlobal("sessionStorage", { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key) }); vi.stubGlobal("fetch", fetchMock);
  memory.set(saleDraftStorageKey(9), JSON.stringify(draft));
});
it("freezes mixed delivered payments after network loss and replays after closure without changing the key", async () => {
  let tree = render();
  (find(tree, (node) => node.type === CashPaymentFields).props.onChange as (rows: unknown) => void)([{ method: "pix", value: "40" }, { method: "dinhe", value: "100" }]);
  tree = render(); fetchMock.mockRejectedValueOnce(new Error("network")); await confirm(tree);
  const command = readStoredCashCommand(saleCommandStorageKey(9));
  expect(command?.payload).toMatchObject({ periodId: 9, cpf: draft.cpf, payments: [{ method: "pix", value: "40.00" }, { method: "dinhe", value: "100.00" }] });
  hooks.slots = []; tree = render(true);
  expect(find(tree, (node) => node.type === CashPaymentFields).props).toMatchObject({ disabled: true, rows: command?.payload.payments });
  expect(find(tree, (node) => node.type === "button" && text(node).includes("Conferir tentativa anterior")).props.disabled).toBe(false);
  fetchMock.mockResolvedValueOnce(Response.json({ ok: true, data: { purchaseId: 10, voucherIds: [1], message: "Concluída", totalCents: 10000, receivedCents: 14000, changeCents: 4000 } }));
  await confirm(tree);
  expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[1][1].body);
  expect(readStoredCashCommand(saleCommandStorageKey(9))).toBeNull(); expect(memory.has(saleDraftStorageKey(9))).toBe(false);
  expect(nodes(render(true)).some((node) => text(node).includes("Troco confirmado"))).toBe(true);
});
it("requires an explicit click for free courtesies and sends no artificial payment", async () => {
  memory.set(saleDraftStorageKey(9), JSON.stringify({ ...draft, items: [], totalValue: "0.00", courtesies: [{ authorId: 2, authorName: "Diretoria", quantity: 1, identification: "Pessoa", note: "" }] }));
  const tree = render(); expect(fetchMock).not.toHaveBeenCalled();
  fetchMock.mockResolvedValueOnce(Response.json({ ok: true, data: { purchaseId: 10, voucherIds: [1], message: "Concluída", changeCents: 0 } })); await confirm(tree);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ payments: [], periodId: 9, cpf: draft.cpf });
});
it("blocks an invalid CPF and corrupted storage without sending a new attempt", async () => {
  memory.set(saleDraftStorageKey(9), JSON.stringify({ ...draft, cpf: "11111111111" })); await confirm(render()); expect(fetchMock).not.toHaveBeenCalled();
  hooks.slots = []; memory.set(saleCommandStorageKey(9), "bad JSON"); const tree = render();
  expect(find(tree, (node) => node.type === "button" && text(node).includes("Conferir tentativa anterior")).props.disabled).toBe(true); expect(fetchMock).not.toHaveBeenCalled();
});
it("reservation retry retains the original receipt despite paid state or a closed cashier", async () => {
  const detail = { purchaseId: 12, cpf: draft.cpf, totalValue: "100.00", payableReservation: true, vouchers: [], status: "conc" } as unknown as PainelBilheteriaPurchaseDetail;
  const renderReservation = (paid = false) => { hooks.index = 0; return PainelBilheteriaReservationPayment({ detail: { ...detail, payableReservation: !paid }, periodId: 9, readOnly: paid }); };
  let tree = renderReservation(); (find(tree, (node) => node.type === CashPaymentFields).props.onChange as (rows: unknown) => void)([{ method: "pix", value: "100.00" }]);
  fetchMock.mockRejectedValueOnce(new Error("network")); await confirm(renderReservation());
  hooks.slots = []; tree = renderReservation(true);
  expect(find(tree, (node) => node.type === CashPaymentFields).props.disabled).toBe(true);
  fetchMock.mockResolvedValueOnce(Response.json({ ok: true, data: { message: "Recebido", changeCents: 0 } })); await confirm(tree);
  const body = JSON.parse(fetchMock.mock.calls[0][1].body); expect(body).toMatchObject({ periodId: 9, payments: [{ method: "pix", value: "100.00" }] }); expect(body).not.toHaveProperty("cpf"); expect(body).not.toHaveProperty("actor");
  expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[1][1].body);
});
