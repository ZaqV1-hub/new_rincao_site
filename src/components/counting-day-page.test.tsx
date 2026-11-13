import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach,describe,expect,it,vi } from 'vitest';
import type { CountingDay } from '@/lib/trip-counting';
import { CountingDayPage } from './counting-day-page';
const { read } = vi.hoisted(() => ({ read: vi.fn() }));
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
    expect(html).toContain('3 até agora · provisório');
    expect(html).toContain('pessoas confirmadas nos passeios');
    expect(html).toContain('>0</strong>');
    expect(html).toContain('há passeios sem previsão');
    expect(html).toContain('Agora na equipe');
    expect(html).toContain('Monitor A');
  });
  it('only queries and links to gate attendance with the server-granted permission',() => {
    expect(render()).not.toContain('/contagem/day-use');
    expect(read.mock.calls.some(([url]) => url.endsWith('/entradas'))).toBe(false);
    const html = render(fixture(),true);
    expect(html).toContain('/contagem/day-use?date=2026-11-13');
    expect(html).toContain('2 ingressos lidos');
  });
  it('blocks adding vehicles in future dates even for managers and in closed days',() => {
    const future = fixture(); future.date = '2026-11-14';
    expect(render(future)).not.toContain('Chegou mais um');
    const closed = fixture(); closed.closed = true;
    expect(render(closed)).not.toContain('Chegou mais um');
    expect(render(closed)).toContain('Ver relatórios do dia');
  });
});
