import React from 'react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { PainelTripSettlement,Participants,TripRefunds } from './painel-trip-settlement';
import type { PublicTripDetail } from '@/lib/trip-settlement-route';

type Bank = { slots: unknown[]; cursor: number; effects: Map<number,unknown[]>; queued: (() => void | (() => void))[]; cleanups: (() => void)[] };
const hooks = vi.hoisted(() => ({ active: null as Bank | null }));
vi.mock('react',async original => ({ ...await original<typeof import('react')>(),
  useState(initial: unknown) { const bank = hooks.active!,index = bank.cursor++; if (!(index in bank.slots)) bank.slots[index] = typeof initial === 'function' ? initial() : initial; return [bank.slots[index],(next: unknown) => { bank.slots[index] = typeof next === 'function' ? next(bank.slots[index]) : next; }]; },
  useRef(initial: unknown) { const bank = hooks.active!,index = bank.cursor++; if (!(index in bank.slots)) bank.slots[index] = { current: initial }; return bank.slots[index]; },
  useCallback(fn: unknown) { return fn; },
  useEffect(run: () => void | (() => void),dependencies: unknown[]) { const bank = hooks.active!,index = bank.cursor++,old = bank.effects.get(index); if (!old || dependencies.some((value,i) => !Object.is(value,old[i]))) { bank.effects.set(index,dependencies); bank.queued.push(run); } },
}));
const bank = (): Bank => ({ slots: [],cursor: 0,effects: new Map(),queued: [],cleanups: [] });
function render<T>(state: Bank,run: () => T) { hooks.active = state; state.cursor = 0; return run(); }
async function effects(state: Bank) { state.queued.splice(0).forEach(run => { const cleanup = run(); if (cleanup) state.cleanups.push(cleanup); }); for (let i=0;i<10;i++) await Promise.resolve(); }
type Node = React.ReactElement<Record<string,unknown>>;
function nodes(value: unknown): Node[] { if (Array.isArray(value)) return value.flatMap(nodes); if (!React.isValidElement(value)) return []; const node = value as Node; return [node,...nodes(node.props.children)]; }
function find(tree: unknown,predicate: (node: Node) => boolean) { const node = nodes(tree).find(predicate); if (!node) throw new Error('UI element not found'); return node; }
function plain(value: unknown): string { return Array.isArray(value) ? value.map(plain).join('') : React.isValidElement(value) ? plain((value as Node).props.children) : typeof value === 'string' || typeof value === 'number' ? String(value) : ''; }
const person = { voucherId: 8,purchaseId: 18,name: 'Rafael Silva',category: 'adult',paidCents: 9000,refundRequested: false,refundPaidAt: null };
const source = { agendaId: 1,clientId: 2,clientName: 'Escola teste',date: '2026-11-16',today: '2026-11-16',configuration: { adultPriceCents: 9000,childPriceCents: 8000,adultCourtesies: 0,childCourtesies: 0 },sitePrices: { adultPriceCents: 9000,childPriceCents: 8000 },vehicles: [],participants: [person,{ ...person,voucherId: 9,purchaseId: 19,refundRequested: true }],payments: [],warnings: [],financialVersion: 1,fingerprint: 'initial',receiptId: null,remainingCents: 9000 } as unknown as PublicTripDetail['source'];
const fetchMock = vi.fn(),memory = new Map<string,string>();
beforeEach(() => { memory.clear(); fetchMock.mockReset(); vi.stubGlobal('fetch',fetchMock); vi.stubGlobal('sessionStorage',{ getItem: (key: string) => memory.get(key) ?? null,setItem: (key: string,value: string) => memory.set(key,value),removeItem: (key: string) => memory.delete(key) }); vi.stubGlobal('document',{ visibilityState: 'visible',addEventListener: vi.fn(),removeEventListener: vi.fn() }); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('shows purchase links and absent status directly in the full presence table',() => {
  const tree = render(bank(),() => Participants({ source,run: vi.fn(),locked: false }));
  expect(tree.type).toBe('details'); expect(plain(tree)).toContain('Lista de presença');
  expect(nodes(tree).filter(n => n.type === 'tr')).toHaveLength(3);
  expect(plain(tree)).toContain('Não veio · reembolso');
  expect(nodes(tree).filter(n => n.props.href === '/painel/compras/18')).toHaveLength(1);
});

it('selects the exact voucher among duplicate names and requires a reason before changing absence',() => {
  const state = bank(),run = vi.fn(),props = { source,run,sessions: [],locked: false };
  let tree = render(state,() => TripRefunds(props));
  (find(tree,n => n.type === 'input').props.onChange as (e: unknown) => void)({ target: { value: 'Ráfael' } });
  tree = render(state,() => TripRefunds(props));
  const results = find(tree,n => n.props['aria-label'] === 'Pessoas encontradas');
  expect(plain(results)).toContain('Compra #18'); expect(plain(results)).not.toContain('Compra #19');
  (find(results,n => n.type === 'button').props.onClick as () => void)();
  tree = render(state,() => TripRefunds(props));
  const form = find(tree,n => n.props.action === 'participant');
  expect((form.props.payload as (d: FormData) => unknown)(new FormData())).toEqual({ voucherId: 8,category: 'adult',refundRequested: true });
  expect(nodes(form).some(n => n.props.required === true)).toBe(true); expect(run).not.toHaveBeenCalled();
  expect(plain(tree)).toContain('Total a reembolsar:'); expect(plain(tree)).toContain('90,00');
});

it('prevents removing paid refunds while keeping their record visible',() => {
  const paid = { ...source,participants: [{ ...source.participants[1],refundPaidAt: '2026-11-16' }] };
  const tree = render(bank(),() => TripRefunds({ source: paid,run: vi.fn(),sessions: [],locked: false }));
  expect(find(tree,n => n.type === 'button' && plain(n).includes('Tirar')).props.disabled).toBe(true);
  expect(plain(tree)).toContain('Reembolso registrado'); expect(plain(tree)).toContain('0,00');
});

it('retains the fingerprint from the start of editing when polling receives newer data',async () => {
  vi.useFakeTimers(); const state = bank(),props = { agendaId: 1,clientId: 2,actorCpf: 'operator',isManager: true };
  let current = source;
  fetchMock.mockImplementation(async (url: string,options?: { method?: string }) => options?.method === 'POST' ? Response.json({ ok: false,error: { message: 'Dados mudaram. Confira novamente.' } },{ status: 409 }) : Response.json({ ok: true,data: url.includes('/caixas') ? [] : { source: current,history: [],receipt: null } }));
  render(state,() => PainelTripSettlement(props)); await effects(state);
  let tree = render(state,() => PainelTripSettlement(props));
  (tree.props.onChangeCapture as (e: unknown) => void)({ target: { closest: () => ({}) } });
  current = { ...source,financialVersion: 2,fingerprint: 'new-count' };
  await vi.advanceTimersByTimeAsync(5000);
  tree = render(state,() => PainelTripSettlement(props));
  const configure = find(tree,n => n.props.action === 'configure');
  await (configure.props.run as (action: string,payload: unknown) => Promise<boolean>)('configure',{ configuration: source.configuration });
  const post = fetchMock.mock.calls.find(([,options]) => options?.method === 'POST');
  expect(JSON.parse(post![1].body)).toMatchObject({ version: 1,fingerprint: 'initial' });
  state.cleanups.forEach(cleanup => cleanup());
});

it('replaces every draft with current values when explicitly refreshing or confirming another operation',async () => {
  const state = bank(),props = { agendaId: 1,clientId: 2,actorCpf: 'operator',isManager: true };
  let current = source;
  fetchMock.mockImplementation(async (url: string,options?: { method?: string }) => options?.method === 'POST' ? Response.json({ ok: true,data: {} }) : Response.json({ ok: true,data: url.includes('/caixas') ? [] : { source: current,history: [],receipt: null } }));
  render(state,() => PainelTripSettlement(props)); await effects(state);
  let tree = render(state,() => PainelTripSettlement(props));
  const initialKey = find(tree,n => n.type === React.Fragment).key;
  (tree.props.onChangeCapture as (e: unknown) => void)({ target: { closest: () => ({}) } });
  current = { ...source,financialVersion: 2,fingerprint: 'new-price',configuration: { ...source.configuration,adultPriceCents: 9500 } };
  await (find(tree,n => n.type === 'button' && plain(n) === 'Conferir dados atuais').props.onClick as () => Promise<void>)();
  tree = render(state,() => PainelTripSettlement(props));
  const refreshedKey = find(tree,n => n.type === React.Fragment).key;
  expect(refreshedKey).not.toBe(initialKey);
  expect(find(tree,n => n.props.name === 'adultPrice').props.defaultValue).toBe('9500');
  (tree.props.onChangeCapture as (e: unknown) => void)({ target: { closest: () => ({}) } });
  await (find(tree,n => n.props.action === 'planning').props.run as (action: string,payload: unknown) => Promise<boolean>)('planning',{ plannedPeople: 10,vehicles: [] });
  tree = render(state,() => PainelTripSettlement(props));
  expect(find(tree,n => n.type === React.Fragment).key).not.toBe(refreshedKey);
  const post = fetchMock.mock.calls.find(([,options]) => options?.method === 'POST');
  expect(JSON.parse(post![1].body)).toMatchObject({ version: 2,fingerprint: 'new-price' });
  state.cleanups.forEach(cleanup => cleanup());
});

it('requires an explicit action to create missing programming before editing trip data',async () => {
  const { TripDataEditor } = await import('./painel-trip-settlement-data');
  const state = bank(),props = { source,disabled: false,onChanged: vi.fn() };
  fetchMock.mockResolvedValue(Response.json({ ok: true,data: { version: null,closed: false,groups: [],carriers: [] } }));
  let tree = render(state,() => TripDataEditor(props));
  (find(tree,n => n.type === 'button').props.onClick as () => void)();
  await vi.waitFor(() => expect(plain(render(state,() => TripDataEditor(props)))).toContain('Crie a programação'));
  expect(fetchMock).toHaveBeenCalledTimes(1); expect(fetchMock.mock.calls[0][1]).toEqual({ cache: 'no-store' });
  tree = render(state,() => TripDataEditor(props));
  expect(nodes(tree).some(n => n.type === 'button' && plain(n) === 'Criar programação e editar dados')).toBe(true);
});

it('preserves a trip-data draft after an uncertain save and refreshes its programming version before another attempt',async () => {
  const { TripDataEditor } = await import('./painel-trip-settlement-data');
  const state = bank(),onChanged = vi.fn(),props = { source,disabled: false,onChanged };
  const program = { version: 3,closed: false,groups: [{ agendaId: 1,clientId: 2,observations: 'original' }],carriers: [] };
  fetchMock.mockResolvedValueOnce(Response.json({ ok: true,data: program }));
  let tree = render(state,() => TripDataEditor(props));
  (find(tree,n => n.type === 'button').props.onClick as () => void)();
  await vi.waitFor(() => expect(nodes(render(state,() => TripDataEditor(props))).some(n => n.props.onSave)).toBe(true));
  tree = render(state,() => TripDataEditor(props));
  fetchMock.mockRejectedValueOnce(new Error('Resposta perdida'));
  (find(tree,n => !!n.props.onSave).props.onSave as (value: unknown) => void)({ agendaId: 1,clientId: 2,observations: 'rascunho' });
  await vi.waitFor(() => expect(plain(render(state,() => TripDataEditor(props)))).toContain('Rascunho preservado'));
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ version: 3,groups: [{ observations: 'rascunho' }] });
  expect(onChanged).not.toHaveBeenCalled();
  fetchMock.mockResolvedValueOnce(Response.json({ ok: true,data: { ...program,version: 4 } }));
  tree = render(state,() => TripDataEditor(props));
  (find(tree,n => n.type === 'button').props.onClick as () => void)();
  await vi.waitFor(() => expect(find(render(state,() => TripDataEditor(props)),n => !!n.props.onSave).props.group).toMatchObject({ observations: 'rascunho' }));
  expect(fetchMock).toHaveBeenCalledTimes(3);
});
