import { afterEach,describe,expect,it,vi } from 'vitest';
import { sendCountingCommand } from './trip-counting-client';
const body = { version: 1,idempotencyKey: 'same-key' };
afterEach(() => vi.unstubAllGlobals());
describe('counting command confirmation',() => {
  it('reconciles before repeating and does not send again after a lost response',async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ok: true,data: { vehicleId: 9 } })); vi.stubGlobal('fetch',fetcher);
    expect(await sendCountingCommand('/api/contagem/veiculos/9/start',body,true)).toMatchObject({ ok: true,data: { vehicleId: 9 } });
    expect(fetcher).toHaveBeenCalledTimes(1); expect(fetcher.mock.calls[0][0]).toBe('/api/contagem/comandos/same-key');
  });
  it('repeats the identical command only after the server reports it absent',async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ ok: true,data: null })).mockResolvedValueOnce(Response.json({ ok: true,data: { vehicleId: 9 } })); vi.stubGlobal('fetch',fetcher);
    expect(await sendCountingCommand('/api/contagem/veiculos/9/start',body,true)).toMatchObject({ ok: true });
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual(body);
  });
  it.each([401,403,503])('keeps uncertainty on status %s',async status => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ ok: false,error: { message: 'Falha' } },{ status })));
    expect(await sendCountingCommand('/url',body,false)).toMatchObject({ ok: false,uncertain: true });
  });
  it('does not discard a key whose contents conflict',async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ ok: false,error: { code: 'count_idempotency_conflict',message: 'Conflito' } },{ status: 409 })));
    expect(await sendCountingCommand('/url',body,false)).toMatchObject({ ok: false,uncertain: true });
  });
  it('reports definitive validation without claiming success',async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ ok: false,error: { message: 'Confira as quantidades' } },{ status: 400 })));
    expect(await sendCountingCommand('/url',body,false)).toEqual({ ok: false,uncertain: false,message: 'Confira as quantidades' });
  });
});
