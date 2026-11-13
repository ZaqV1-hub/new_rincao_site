import { beforeEach,describe,expect,it,vi } from 'vitest';
import { runTripFinancialRoute,readTripFinancialBody } from './trip-settlement-route';
const auth = vi.hoisted(() => vi.fn());
vi.mock('@/lib/painel-api-auth',() => ({ requirePainelApiAccess: auth }));
beforeEach(() => { auth.mockReset(); auth.mockResolvedValue({ ok: true,legacyResources: ['vis_contagem'],session: { actorName: 'Maria',actorCpf: '52998224725',legacyRoleId: 1 } }); });
describe('financial trip trust boundary',() => {
  it('requires cash, agenda and group permissions and derives the actor from the session',async () => {
    const callback = vi.fn(async actor => Response.json(actor)); const response = await runTripFinancialRoute(new Request('http://localhost'),callback);
    expect(auth.mock.calls.map(call => call[1])).toEqual(['vis_bilhet','vis_agenda',['vis_clientes','vis_escola']]);
    expect(callback).toHaveBeenCalledWith({ name: 'Maria',cpf: '52998224725',manager: true,canReadSignatures: true });
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('does not call the financial service for denied group access',async () => {
    auth.mockResolvedValueOnce({ ok: true,session: {} }).mockResolvedValueOnce({ ok: true,session: {} }).mockResolvedValueOnce({ ok: false,response: Response.json({}, { status: 403 }) });
    const callback = vi.fn(); expect((await runTripFinancialRoute(new Request('http://localhost'),callback)).status).toBe(403); expect(callback).not.toHaveBeenCalled();
  });
  it('caps the actual body, not only Content-Length, and rejects query overrides',async () => {
    const large = new Request('http://localhost',{ method: 'POST',headers: { 'content-type': 'application/json' },body: JSON.stringify({ notes: 'x'.repeat(65536) }) });
    await expect(readTripFinancialBody(large)).rejects.toMatchObject({ code: 'trip_invalid_input' });
    await expect(readTripFinancialBody(new Request('http://localhost?park=estancia',{ method: 'POST',headers: { 'content-type': 'application/json' },body: '{}' }))).rejects.toMatchObject({ code: 'trip_invalid_input' });
  });
});
