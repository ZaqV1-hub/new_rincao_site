import { beforeEach, describe, expect, it, vi } from "vitest";
import { PurchaseBatchError } from "@/lib/operational-purchase-batch-contract";
const mock = vi.hoisted(() => ({ access: vi.fn(), preview: vi.fn(), apply: vi.fn(),email: vi.fn(),history: vi.fn() }));
vi.mock("@/lib/painel-api-auth", () => ({ requirePainelApiAccess: mock.access }));
vi.mock("@/lib/operational-purchase-batch", () => ({ previewPurchaseBatch: mock.preview,applyPurchaseBatch: mock.apply }));
vi.mock("@/lib/operational-purchase-batch-email", () => ({ dispatchPurchaseBatchEmail: mock.email,listPurchaseBatchEmail: mock.history }));
const data = { purchaseIds: [1],targetDate: '2099-07-20',validity: '7_days',reason: 'Chuva',notifyEmail: false };
async function call(action = 'preview',body: unknown = data,raw?: string) {
  const { POST } = await import('./route');
  return POST(new Request('https://local.invalid/api/painel/compras/lote/'+action,{ method: 'POST',headers: { 'Content-Type': 'application/json' },body: raw ?? JSON.stringify(body) }),{ params: Promise.resolve({ action }) });
}
describe('strict panel batch API', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mock.access.mockResolvedValue({ ok: true,legacyResources: ['vis_compra','vis_bilhet'],session: { actorName: 'Ana',actorCpf: '52998224725' } });
    mock.preview.mockResolvedValue({ items: [],fingerprint: 'a'.repeat(64) }); mock.apply.mockResolvedValue({ batchId: 'saved' });
  });
  it('previews without writes and applies with the session actor', async () => {
    expect((await call()).status).toBe(200); expect(mock.apply).not.toHaveBeenCalled();
    const command = { ...data,fingerprint: 'a'.repeat(64),idempotencyKey: 'first' };
    expect((await call('apply',command)).status).toBe(200);
    expect(mock.apply).toHaveBeenCalledWith(command,{ name: 'Ana',cpf: '52998224725' });
  });
  it.each([401,403])('preserves denied session %s with private cache headers', async status => {
    mock.access.mockResolvedValue({ ok: false,response: Response.json({ ok: false },{ status }) });
    const response = await call(); expect(response.status).toBe(status); expect(response.headers.get('Cache-Control')).toBe('private, no-store'); expect(mock.preview).not.toHaveBeenCalled();
  });
  it('requires write permission even to preview', async () => {
    mock.access.mockResolvedValue({ ok: true,legacyResources: ['vis_compra'],session: {} }); expect((await call()).status).toBe(403); expect(mock.preview).not.toHaveBeenCalled();
  });
  it.each(['remove','delete','unknown'])('rejects unsupported action %s', async action => { expect((await call(action)).status).toBe(400); });
  it.each(['{',' '.repeat(70000)])('rejects malformed or oversized streamed bodies', async raw => {
    expect((await call('preview',data,raw)).status).toBe(400); expect(mock.preview).not.toHaveBeenCalled();
  });
  it('returns domain conflict but no raw internal details', async () => {
    mock.apply.mockRejectedValue(new PurchaseBatchError('batch_preview_changed','Confira a prévia.'));
    const conflict = await call('apply'); expect(conflict.status).toBe(409); expect(await conflict.json()).toMatchObject({ error: { code: 'batch_preview_changed' } });
    mock.preview.mockRejectedValue(new Error('secret database details')); const failed = await call(); expect(failed.status).toBe(503); expect(JSON.stringify(await failed.json())).not.toContain('secret');
  });
  it('scopes email dispatch and recovery history to the authenticated operator', async () => {
    mock.email.mockResolvedValue({ pending: 0,accepted: 1 });
    expect((await call('email',{ batchId: 'saved' })).status).toBe(200);
    expect(mock.email).toHaveBeenCalledWith('saved',{ name: 'Ana',cpf: '52998224725' });
    expect((await call('email',{ batchId: 'saved',actor: 'forged' })).status).toBe(400);
    mock.history.mockResolvedValue([]); const { GET } = await import('./route');
    const response = await GET(new Request('https://local.invalid/api/painel/compras/lote/email'),{ params: Promise.resolve({ action: 'email' }) });
    expect(response.status).toBe(200); expect(mock.history).toHaveBeenCalledWith({ name: 'Ana',cpf: '52998224725' });
  });
});
