import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readCountingBody, runCountingRoute } from './trip-counting-route';
import { TripCountingError } from './trip-counting-contract';
const mock = vi.hoisted(() => ({ access: vi.fn() }));
vi.mock('@/lib/painel-api-auth', () => ({ requirePainelApiAccess: mock.access }));
describe('counting trust boundary', () => {
  beforeEach(() => { mock.access.mockReset().mockResolvedValue({ ok: true,session: { actorName: 'Ana',actorCpf: '52998224725',legacyRoleId: 2 } }); });
  it('uses only the panel identity and manager role from the session', async () => {
    const callback = vi.fn(async actor => Response.json(actor)); const response = await runCountingRoute(new Request('https://local.invalid/contagem'),callback);
    expect(mock.access).toHaveBeenCalledWith(expect.any(Request),'vis_contagem'); expect(await response.json()).toEqual({ name: 'Ana',cpf: '52998224725',manager: false });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });
  it.each([401,403])('preserves authorization rejection %s', async status => {
    mock.access.mockResolvedValue({ ok: false,response: Response.json({ ok: false },{ status }) }); const callback = vi.fn();
    expect((await runCountingRoute(new Request('https://local.invalid/contagem'),callback)).status).toBe(status); expect(callback).not.toHaveBeenCalled();
  });
  it('retains domain errors without exposing internal data', async () => {
    const request = new Request('https://local.invalid/contagem');
    expect((await runCountingRoute(request,async () => { throw new TripCountingError('count_version_conflict','Confira o estado atual.'); })).status).toBe(409);
    const response = await runCountingRoute(request,async () => { throw new Error('database password'); }); expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain('password');
  });
  it('limits actual streamed bytes without relying on Content-Length', async () => {
    const request = new Request('https://local.invalid/contagem',{ method: 'POST',headers: { 'Content-Type': 'application/json','Content-Length': '1' },body: ' '.repeat(524289) });
    await expect(readCountingBody(request)).rejects.toMatchObject({ code: 'count_invalid_input' });
  });
  it('rejects query overrides and invalid JSON or content type', async () => {
    for (const [url,type,body] of [['https://local.invalid/contagem?actor=1','application/json','{}'],['https://local.invalid/contagem','text/plain','{}'],['https://local.invalid/contagem','application/json','{']]) {
      await expect(readCountingBody(new Request(url,{ method: 'POST',headers: { 'Content-Type': type },body }))).rejects.toMatchObject({ code: 'count_invalid_input' });
    }
  });
});
