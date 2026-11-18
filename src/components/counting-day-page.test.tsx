import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach,describe,expect,it,vi } from 'vitest';
import type { CountingDay } from '@/lib/trip-counting';
import { CountingDayPage } from './counting-day-page';
const { read,commandState,refs,effects } = vi.hoisted(() => ({ read: vi.fn(),commandState: { blocked: false,pending: null as null | { key: string; url: string } },refs: [] as { current: unknown }[],effects: [] as { run: () => unknown; dependencies: unknown[] | undefined }[] }));
vi.mock('react',async original => {
  const actual = await original<typeof import('react')>();
  return { ...actual,useRef: (value: unknown) => { const ref = actual.useRef(value); refs.push(ref); return ref; },useEffect: (run: () => unknown,dependencies?: unknown[]) => { effects.push({ run,dependencies }); } };
});
vi.mock('next/navigation',() => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('./counting-controls',async importOriginal => ({
  ...await importOriginal<typeof import('./counting-controls')>(),
  useCountingRead: read,
  useCountingCommand: () => ({ ...commandState,ready: !commandState.blocked || commandState.pending !== null,busy: false,message: '' }),
}));
afterEach(() => { vi.clearAllMocks(); commandState.blocked=false; commandState.pending=null; refs.length=0; effects.length=0; });
function fixture(): CountingDay {
  const vehicle = { id: 9,agendaId: 1,clientId: 2,date: '2026-11-13',clientName: 'Escola Teste',type: 'bus' as const,plannedPeople: 40,state: 'counting' as const,version: 2,addedOnDay: true,isExtra: true,ordinal: 2,transportName: 'Transportadora A',groupType: 'school' as const,financiallyFinalized: false,currentRevision: 'revision',lastCompletedRevision: null,total: null,draftSubtotal: 3,ownerName: 'Monitor A',startedAt: '2026-11-13T12:00:00.000Z' };
  return { date: '2026-11-13',today: '2026-11-13',park: 'rincao',closed: false,generatedAt: '2026-11-13T12:01:00.000Z',carriers: [],feed: [{ id: 1,action: 'start',vehicleId: 9,actorName: 'Monitor A',at: '2026-11-13T12:00:00.000Z' }],groups: [{ agendaId: 1,clientId: 2,clientName: 'Escola Teste',groupType: 'school',foodNotes: null,plannedPeople: null,transportName: 'Transportadora A',vehicleCounts: { planned: 0,extra: 1,waiting: 0,counting: 1,completed: 0 },vehicles: [vehicle] }] };
}
function render(data = fixture(),canGate = false) {
  read.mockImplementation((url: string) => ({ data: url.endsWith('/entradas') ? { admitted: 2,sold: 5,expected: 3 } : data,error: '',checkedAt: '',refresh: vi.fn() }));
  return renderToStaticMarkup(<CountingDayPage date={data.date} manager actorCpf="52998224725" canGate={canGate}/>);
}
describe('counting day mobile cards',() => {
  it('keeps native date scrolling available without intercepting vertical gestures',() => {
    const nav = render().match(/<nav[\s\S]*?<\/nav>/)?.[0] ?? '';
    expect(nav).toContain('overflow-x-auto');
    expect(nav).toContain('[scrollbar-width:thin]');
    expect(nav).not.toContain('[scrollbar-width:none]');
    expect(nav.match(/href="\/contagem\?date=/g)).toHaveLength(8);
    expect(nav).toContain('href="/contagem?date=2026-11-13" aria-current="date"');
  });
  it('positions the selected date horizontally without moving the page vertically',() => {
    render();
    const strip = { scrollLeft: 50,scrollTop: 120,clientWidth: 320,getBoundingClientRect: () => ({ left: 100 }) };
    refs[0].current = { parentElement: strip,offsetWidth: 58,getBoundingClientRect: () => ({ left: 300 }) };
    const effect = effects.find(item => item.dependencies?.[0] === fixture().date);
    expect(effect).toBeDefined();
    effect!.run();
    expect(strip.scrollLeft).toBe(119);
    expect(strip.scrollTop).toBe(120);
  });
  function emptyDay({ hasDayUse = false,sold = 0,admitted = 0,closed = false,dayError = '',attendanceError = '',loadingDay = false,loadingAttendance = false,withGroup = false } = {}) {
    const data = fixture(); data.closed = closed; if (!withGroup) data.groups = []; data.feed = [];
    read.mockImplementation((url: string) => ({ data: url.endsWith('/entradas') ? (loadingAttendance ? null : { date: data.date,hasDayUse,sold,admitted,expected: Math.max(0,sold-admitted) }) : (loadingDay ? null : data),error: url.endsWith('/entradas') ? attendanceError : dayError,checkedAt: '',refresh: vi.fn() }));
    return renderToStaticMarkup(<CountingDayPage date={data.date} manager actorCpf="52998224725" canGate/>);
  }
  it('shows only the prototype empty state and date navigation when no trips or day use exist',() => {
    const html = emptyDay();
    expect(html).toContain('Sem movimento em sexta-feira, 13 de novembro');
    expect(html).toContain('Não há passeios nem day use nesta data.');
    expect(html).toContain('Dias de contagem');
    for (const content of ['Resumo do parque','Day use','Passeios ·','Ler QR','Finalizar contagem','Ver relatórios','Consultando passeios']) expect(html).not.toContain(content);
  });
  it.each([{ hasDayUse: true },{ sold: 1 },{ admitted: 1 },{ closed: true },{ withGroup: true }])('keeps movement visible for %j',options => {
    const html = emptyDay(options);
    expect(html).not.toContain('Sem movimento');
    expect(html).toContain('Resumo do parque');
    if (options.closed) expect(html).toContain('Ver relatórios do dia');
  });
  it.each([{ loadingDay: true },{ loadingAttendance: true },{ dayError: 'Falha nos passeios' },{ attendanceError: 'Falha nas entradas' }])('does not claim no movement while data is incomplete or stale: %j',options => {
    const html = emptyDay(options);
    expect(html).not.toContain('Sem movimento');
    if (options.dayError || options.attendanceError) expect(html).toContain('role="alert"');
  });
  it('keeps command recovery available when the last group disappears',() => {
    commandState.blocked=true; commandState.pending={key:'pending',url:'/api/contagem/veiculos'};
    const html=emptyDay(); expect(html).not.toContain('Sem movimento'); expect(html).toContain('Conferir a mesma tentativa');
  });
  it('waits for command recovery before showing an empty day',() => {
    commandState.blocked=true; expect(emptyDay()).not.toContain('Sem movimento');
  });
  it('shows ordinal, extra, carrier and explicitly provisional draft without counting it as confirmed presence',() => {
    const html = render();
    expect(html).toContain('Ônibus 2');
    expect(html).toContain('Transportadora A');
    expect(html).toContain('3 até agora');
    expect(html).toContain('Contagem provisória');
    expect(html).toContain('Monitor A está contando');
    expect(html).not.toContain('Outra data');
    expect(html).toContain('pessoas contadas no parque');
    expect(html).toContain('>2</strong>');
    expect(html).toContain('há passeios sem previsão');
    expect(html).toContain('Agora na equipe');
    expect(html).toContain('Monitor A');
  });
  it('includes attendance without gate permission but only offers QR with gate permission on today',() => {
    expect(render()).not.toContain('/contagem/day-use');
    expect(read.mock.calls.some(([url]) => url.endsWith('/entradas'))).toBe(true);
    const html = render(fixture(),true);
    expect(html).toContain('/contagem/day-use?date=2026-11-13');
    expect(html).toContain('2 ingressos lidos');
    const past=fixture();past.today='2026-11-14';
    expect(render(past,true)).not.toContain('/contagem/day-use');
  });
  it('identifies the author of a completed count and distinguishes a single passenger',() => {
    const data = fixture(); Object.assign(data.groups[0].vehicles[0],{ state: 'completed',total: 1,draftSubtotal: null });
    const html = render(data); expect(html).toContain('Contado por Monitor A'); expect(html).toContain('1 pessoa'); expect(html).not.toContain('1 pessoas');
  });
  it('links each group to its contextual detail',() => { expect(render()).toContain('/contagem/passeios/1/2?date=2026-11-13'); });
  it('blocks adding vehicles in future dates even for managers and in closed days',() => {
    const future = fixture(); future.date = '2026-11-14';
    expect(render(future)).not.toContain('Chegou mais um');
    expect(render(future)).not.toContain('Finalizar contagem do dia');
    const closed = fixture(); closed.closed = true;
    expect(render(closed)).not.toContain('Chegou mais um');
    expect(render(closed)).toContain('Ver relatórios do dia');
  });
});
