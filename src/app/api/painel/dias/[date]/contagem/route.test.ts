import { beforeEach,describe,expect,it,vi } from 'vitest';
import { GET } from './route';
const mock = vi.hoisted(() => ({ auth: vi.fn(),read: vi.fn() }));
vi.mock('@/lib/painel-api-auth',() => ({ requirePainelApiAccess: mock.auth }));
vi.mock('@/lib/trip-counting',() => ({ getCountingDay: mock.read }));
const request = () => new Request('http://localhost/api/painel/dias/2026-11-13/contagem');
const context = { params: Promise.resolve({ date: '2026-11-13' }) };
beforeEach(() => { vi.clearAllMocks(); mock.auth.mockResolvedValue({ ok: true }); mock.read.mockResolvedValue({ groups: [] }); });
describe('read-only panel counting access',() => {
  it('requires both agenda and group access without granting counting edits',async () => {
    const response = await GET(request(),context);
    expect(response.status).toBe(200); expect(mock.auth.mock.calls.map(call => call[1])).toEqual(['vis_agenda',['vis_clientes','vis_escola']]);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('stops before reading when the second permission is absent',async () => {
    mock.auth.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false,response: Response.json({ ok: false },{ status: 403 }) });
    expect((await GET(request(),context)).status).toBe(403); expect(mock.read).not.toHaveBeenCalled();
  });
  it('does not invent an empty list when the source fails',async () => {
    mock.read.mockRejectedValue(new Error('database unavailable'));
    expect((await GET(request(),context)).status).toBe(503);
  });
});
