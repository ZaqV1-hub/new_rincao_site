import { beforeEach,expect,it,vi } from 'vitest';
const query = vi.hoisted(() => vi.fn());
vi.mock('./painel-operational-catalog',async original => ({ ...await original<typeof import('./painel-operational-catalog')>(),getOperationalCatalogPool: () => ({ query }) }));
import { listPainelCashLocations } from './painel-cash-locations';
beforeEach(() => { query.mockReset(); });
it('returns the persisted cash type without deriving it from the display name',async () => {
  query.mockResolvedValue({ rows: [{ id: '42',name: 'Recepção escolar',description: '',active: true,version: 1,type: 'trips' }] });
  expect(await listPainelCashLocations()).toEqual([{ id: 42,name: 'Recepção escolar',description: '',active: true,version: 1,type: 'trips' }]);
  expect(query.mock.calls[0][0]).toContain('tipo AS type');
});
