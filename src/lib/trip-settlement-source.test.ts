import { expect,it,vi } from 'vitest';
import type { PoolClient } from 'pg';
import { readTripSettlementSource,tripFingerprint } from './trip-settlement-source';

it('preserves persisted vehicle ordinals when IDs and list positions differ',async () => {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('FROM agenda_extras ae')) return { rows: [{ date: '2026-11-16',today: '2026-11-16',clientName: 'Escola',version: 1,adultPrice: null,childPrice: null,siteAdult: '80',siteChild: '60',adultCourtesies: 0,childCourtesies: 0,receiptId: null }] };
    if (sql.includes("to_regclass('contrato")) return { rows: [{ contract: false,holds: false }] };
    if (sql.includes('FROM passeio_veiculos v')) { expect(sql).toContain('v.ordinal'); return { rows: [{ id: '702',ordinal: 4,type: 'bus',version: 1,state: 'waiting',plannedPeople: 40,revisionId: null }] }; }
    return { rows: [] };
  });
  const source = await readTripSettlementSource({ query } as unknown as PoolClient,{ agendaId: 1,clientId: 2 });
  expect(source.vehicles).toEqual([expect.objectContaining({ id: 702,ordinal: 4 })]);
  expect(source.fingerprint).toBe(tripFingerprint({ ...source,today: undefined,closed: undefined,fingerprint: undefined,vehicles: source.vehicles.map(vehicle => ({ ...vehicle,ordinal: undefined })) }));
});
