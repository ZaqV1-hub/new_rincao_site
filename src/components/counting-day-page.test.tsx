import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach,describe,expect,it,vi } from 'vitest';
import type { CountingDay } from '@/lib/trip-counting';
import { CountingDayPage } from './counting-day-page';
const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('next/navigation',() => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('./counting-controls',async importOriginal => ({
  ...await importOriginal<typeof import('./counting-controls')>(),
  useCountingRead: read,
  useCountingCommand: () => ({ pending: null,ready: true,busy: false,message: '',blocked: false }),
}));
afterEach(() => vi.clearAllMocks());
function fixture(): CountingDay {
  const vehicle = { id: 9,agendaId: 1,clientId: 2,date: '2026-11-13',clientName: 'Escola Teste',type: 'bus' as const,plannedPeople: 40,state: 'counting' as const,version: 2,addedOnDay: true,isExtra: true,ordinal: 2,transportName: 'Transportadora A',groupType: 'school' as const,financiallyFinalized: false,currentRevision: 'revision',lastCompletedRevision: null,total: null,draftSubtotal: 3,ownerName: 'Monitor A',startedAt: '2026-11-13T12:00:00.000Z' };
  return { date: '2026-11-13',today: '2026-11-13',park: 'rincao',closed: false,generatedAt: '2026-11-13T12:01:00.000Z',carriers: [],feed: [{ id: 1,action: 'start',vehicleId: 9,actorName: 'Monitor A',at: '2026-11-13T12:00:00.000Z' }],groups: [{ agendaId: 1,clientId: 2,clientName: 'Escola Teste',groupType: 'school',foodNotes: null,plannedPeople: null,transportName: 'Transportadora A',vehicleCounts: { planned: 0,extra: 1,waiting: 0,counting: 1,completed: 0 },vehicles: [vehicle] }] };
}
function render(data = fixture(),canGate = false) {
  read.mockImplementation((url: string) => ({ data: url.endsWith('/entradas') ? { admitted: 2,sold: 5,expected: 3 } : data,error: '',checkedAt: '',refresh: vi.fn() }));
  return renderToStaticMarkup(<CountingDayPage date={data.date} manager actorCpf="52998224725" canGate={canGate}/>);
}
describe('counting day mobile cards',() => {
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
