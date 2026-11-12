import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { CashSessionCommandForm } from "./cash-session-command-form";
import { PainelCashSessionPage } from "./painel-cash-session-page";
import { PainelCashSessionsPage } from "./painel-cash-sessions-page";
import { CashSessionSnapshotView } from "./cash-session-snapshot-view";
import { PainelBilheteriaWorkstation } from "./painel-bilheteria-workstation";
import { prepareStoredCashCommand, readStoredCashCommand } from "@/lib/cash-command-client";
import type { CashSessionDetail, CashSessionSnapshot } from "@/lib/operational-cash-session";
import type { CashLocation } from "@/lib/operational-day-contract";

type Bank = { slots: unknown[]; cursor: number; effects: Map<number, unknown[]>; queued: (() => void)[] };
const hooks = vi.hoisted(() => ({ active: null as Bank | null, push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: hooks.push }) }));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(),
  useState(initial: unknown) { const bank = hooks.active!, index = bank.cursor++; if (!(index in bank.slots)) bank.slots[index] = typeof initial === "function" ? initial() : initial; return [bank.slots[index], (next: unknown) => { bank.slots[index] = typeof next === "function" ? next(bank.slots[index]) : next; }]; },
  useRef(initial: unknown) { const bank = hooks.active!, index = bank.cursor++; if (!(index in bank.slots)) bank.slots[index] = { current: initial }; return bank.slots[index]; },
  useEffect(run: () => void, dependencies: unknown[]) { const bank = hooks.active!, index = bank.cursor++; const old = bank.effects.get(index); if (!old || dependencies.some((value, i) => !Object.is(value, old[i]))) { bank.effects.set(index, dependencies); bank.queued.push(run); } },
}));
const bank = (): Bank => ({ slots: [], cursor: 0, effects: new Map(), queued: [] });
function render<T>(state: Bank, run: () => T): T { hooks.active = state; state.cursor = 0; return run(); }
async function effects(state: Bank) { state.queued.splice(0).forEach((run) => run()); await Promise.resolve(); }
type Node = React.ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Node[] { if (Array.isArray(value)) return value.flatMap(nodes); if (!React.isValidElement(value)) return []; const node = value as Node; return [node, ...nodes(node.props.children)]; }
function find(tree: unknown, predicate: (node: Node) => boolean) { const node = nodes(tree).find(predicate); if (!node) throw new Error("UI element not found"); return node; }
function plain(value: unknown): string { return Array.isArray(value) ? value.map(plain).join("") : React.isValidElement(value) ? plain((value as Node).props.children) : typeof value === "string" || typeof value === "number" ? String(value) : ""; }
const memory = new Map<string, string>(), fetchMock = vi.fn();
const location: CashLocation = { id: 2, version: 1, name: "Portaria 2", description: "", active: true };
const snapshot: CashSessionSnapshot = { schemaVersion: 1, periodId: 7, park: "rincao", date: "2099-01-01", locationId: 2, locationName: "Portaria 2", type: "sales", generatedAt: "2099-01-01T12:00Z", closedAt: null, openingCashCents: 1000, payments: [], receiptsCount: 0, lastReceiptAt: null, cashReceivedCents: 0, fundsCents: 0, withdrawalsCents: 0, expensesCents: 0, refundsCents: 0, expectedCashCents: 1000, countedCashCents: null, differenceCents: null, sales: { purchaseCount: 0, ticketCount: 0, serviceCount: 0, courtesyCount: 0, revenueCents: 0, serviceRevenueCents: 0, discountCents: 0 }, admissions: { ticketCount: 0, serviceCount: 0, onlineTicketCount: 0, schoolCount: 0, unclassifiedCount: 0 }, services: [], movements: [], pending: [] };
const open: CashSessionDetail = { id: 7, park: "rincao", date: snapshot.date, locationId: 2, locationName: "Portaria 2", type: "sales", openingCashCents: 1000, openedAt: "2099-01-01T10:00Z", closedAt: null, openedBy: { name: "Op", cpf: null }, closedBy: null, closureId: null, countedCashCents: null, automatic: false, snapshot };
const closed: CashSessionDetail = { ...open, closedAt: "2099-01-01T18:00Z", closureId: 4, countedCashCents: 5000, snapshot: { ...snapshot, closedAt: "2099-01-01T18:00Z", expectedCashCents: 5000, countedCashCents: 5000, differenceCents: 0 } };
const pageProps = (initial: CashSessionDetail, initialTab = "movement") => ({ initial, today: snapshot.date, initialTab, sale: <p>NEW SALE MARKER</p>, operator: { name: "Op", cpf: null, isManager: false } });
type FormProps = Parameters<typeof CashSessionCommandForm>[0];
function formProps(tree: unknown): FormProps { return find(tree, (node) => node.type === CashSessionCommandForm).props as FormProps; }
async function submit(tree: unknown, values: Record<string, string> = {}) { const form = { values, reset: vi.fn() }; await (find(tree, (node) => node.type === "form").props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault: vi.fn(), currentTarget: form }); }
async function tab(tree: unknown, id: string) { (find(tree, (node) => node.props.id === `cash-tab-${id}`).props.onClick as () => void)(); await new Promise((resolve) => setTimeout(resolve, 0)); }
beforeEach(() => {
  memory.clear(); fetchMock.mockReset(); hooks.push.mockReset(); hooks.active = null;
  vi.stubGlobal("fetch", fetchMock); vi.stubGlobal("sessionStorage", { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key) });
  vi.stubGlobal("FormData", class { constructor(private form: { values: Record<string, string> }) {} get(key: string) { return this.form.values[key] ?? null; } });
});

it("replays the identical movement after closing and preserves the frozen snapshot if refresh fails", async () => {
  const firstBank = bank(), onSuccess = vi.fn();
  const firstProps: FormProps = { action: "movement", periodId: 7, onSuccess };
  render(firstBank, () => CashSessionCommandForm(firstProps)); await effects(firstBank);
  fetchMock.mockRejectedValueOnce(new Error("lost response"));
  await submit(render(firstBank, () => CashSessionCommandForm(firstProps)), { type: "sangria", amount: "25,00", responsible: "Maria", reason: "Retirada" });
  expect(readStoredCashCommand("cash-movement:7")?.payload).toEqual({ type: "sangria", amountCents: 2500, responsible: "Maria", reason: "Retirada" }); expect(onSuccess).not.toHaveBeenCalled();
  const pageBank = bank(); let page = render(pageBank, () => PainelCashSessionPage(pageProps(closed)));
  fetchMock.mockResolvedValueOnce(Response.json({ ok: true, data: closed })); await tab(page, "movement");
  page = render(pageBank, () => PainelCashSessionPage(pageProps(closed))); const recoveryProps = formProps(page); expect(recoveryProps.disabled).toBe(true);
  const recoveryBank = bank(); render(recoveryBank, () => CashSessionCommandForm(recoveryProps)); await effects(recoveryBank);
  const form = render(recoveryBank, () => CashSessionCommandForm(recoveryProps));
  expect(find(form, (node) => node.type === "button").props.disabled).toBe(false);
  fetchMock.mockResolvedValueOnce(Response.json({ ok: true, data: { movement: { id: 99 }, session: open } })).mockRejectedValueOnce(new Error("refresh lost"));
  await submit(form, { type: "fundo", amount: "999,00", responsible: "Changed", reason: "Changed" });
  await vi.waitFor(() => expect(plain(render(pageBank, () => PainelCashSessionPage(pageProps(closed))))).toContain("Não foi possível atualizar"));
  const posts = fetchMock.mock.calls.filter(([, options]) => options?.method === "POST"); expect(posts).toHaveLength(2); expect(posts[0][1].body).toBe(posts[1][1].body);
  expect(readStoredCashCommand("cash-movement:7")).toBeNull();
  page = render(pageBank, () => PainelCashSessionPage(pageProps(closed)));
  expect(find(page, (node) => node.type === CashSessionSnapshotView).props.snapshot).toEqual(closed.snapshot); expect(formProps(page).disabled).toBe(true); expect(plain(page)).toContain("Fechado");
});

it("refreshes to the current closure instead of retaining the successful replay's old open snapshot", async () => {
  const state = bank(); const page = render(state, () => PainelCashSessionPage(pageProps(open)));
  fetchMock.mockResolvedValueOnce(Response.json({ ok: true, data: closed }));
  await formProps(page).onSuccess({ movement: { id: 99 }, session: open });
  const updated = render(state, () => PainelCashSessionPage(pageProps(open)));
  expect(find(updated, (node) => node.type === CashSessionSnapshotView).props.snapshot).toEqual(closed.snapshot); expect(formProps(updated).disabled).toBe(true);
});

it("mounts and replays an uncertain opening from a previous date without permitting a new opening", async () => {
  const firstBank = bank(); const firstProps: FormProps = { action: "open", date: snapshot.date, locations: [location], onSuccess: vi.fn() };
  render(firstBank, () => CashSessionCommandForm(firstProps)); await effects(firstBank);
  fetchMock.mockRejectedValueOnce(new Error("lost opening response"));
  await submit(render(firstBank, () => CashSessionCommandForm(firstProps)), { locationId: "2", amount: "10,00" });
  const list = PainelCashSessionsPage({ date: snapshot.date, today: "2099-01-02", sessions: [closed], locations: [location] });
  const props = formProps(list); expect(props).toMatchObject({ action: "open", date: snapshot.date, disabled: true });
  const state = bank(); render(state, () => CashSessionCommandForm(props)); await effects(state);
  const recovery = render(state, () => CashSessionCommandForm(props));
  expect(plain(find(recovery, (node) => node.type === "dl"))).toContain("2099-01-01 · Portaria 2");
  expect(find(recovery, (node) => node.type === "button").props.disabled).toBe(false);
  fetchMock.mockResolvedValueOnce(Response.json({ ok: true, data: open })); await submit(recovery, { locationId: "9", amount: "999,00" });
  expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[1][1].body); expect(hooks.push).toHaveBeenCalledWith("/painel/caixas/7"); expect(readStoredCashCommand(`cash-open:${snapshot.date}`)).toBeNull();
  expect(render(state, () => CashSessionCommandForm(props))).toBeNull();
});

it.each([["sangria", "Retirar sangria"], ["fundo", "Adicionar fundo"]])("shows all immutable pending %s fields", async (type, label) => {
  prepareStoredCashCommand("cash-movement:7", { type, amountCents: 2550, responsible: "Maria", reason: "Conferência" });
  const state = bank(), props: FormProps = { action: "movement", periodId: 7, disabled: true, onSuccess: vi.fn() };
  render(state, () => CashSessionCommandForm(props)); await effects(state); const tree = render(state, () => CashSessionCommandForm(props));
  expect(plain(find(tree, (node) => node.type === "dl"))).toContain(label); expect(plain(find(tree, (node) => node.type === "dl"))).toContain("#7");
  const notice = plain(find(tree, (node) => node.props.role === "status")); expect(notice).toContain("25,50"); expect(notice).toContain("Maria"); expect(notice).toContain("Conferência");
  expect(find(tree, (node) => node.type === "fieldset").props).toMatchObject({ hidden: true, disabled: true });
});

it("identifies a pending opening by saved location ID when that location is no longer offered", async () => {
  prepareStoredCashCommand(`cash-open:${snapshot.date}`, { date: snapshot.date, locationId: 2, openingCashCents: 0 });
  const state = bank(), props: FormProps = { action: "open", date: snapshot.date, locations: [], disabled: true, onSuccess: vi.fn() };
  render(state, () => CashSessionCommandForm(props)); await effects(state); const tree = render(state, () => CashSessionCommandForm(props));
  expect(plain(find(tree, (node) => node.type === "dl"))).toContain("2099-01-01 · Local #2"); expect(find(tree, (node) => node.type === "button").props.disabled).toBe(false);
});

it("does not enable mutations while retrying an authoritative read that previously failed", async () => {
  const state = bank(); let page = render(state, () => PainelCashSessionPage(pageProps(open, "consultation")));
  fetchMock.mockRejectedValueOnce(new Error("offline")); await tab(page, "consultation");
  page = render(state, () => PainelCashSessionPage(pageProps(open, "consultation")));
  expect(find(page, (node) => node.type === PainelBilheteriaWorkstation).props.periodId).toBeNull();
  let finish!: (response: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
  (find(page, (node) => node.type === "button" && plain(node).includes("Consultar valores novamente")).props.onClick as () => void)();
  const waiting = render(state, () => PainelCashSessionPage(pageProps(open, "consultation")));
  finish(Response.json({ ok: true, data: closed }));
  expect(find(waiting, (node) => node.type === PainelBilheteriaWorkstation).props.periodId).toBeNull();
});
