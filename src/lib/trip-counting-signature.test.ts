import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { normalizeCountingSignature } from './trip-counting-signature';

async function png(blank = false) {
  const raw = Buffer.alloc(64*32*3,255);
  if (!blank) for (let x = 5; x < 55; x++) for (let y = 10; y < 14; y++) raw.fill(0,(y*64+x)*3,(y*64+x)*3+3);
  return 'data:image/png;base64,'+(await sharp(raw,{ raw: { width: 64,height: 32,channels: 3 } }).png().toBuffer()).toString('base64');
}
describe('private counting signature', () => {
  it('normalizes a PNG and retains a hash and real dimensions', async () => {
    const signature = await normalizeCountingSignature(await png()); expect(signature.width).toBe(64); expect(signature.height).toBe(32);
    expect(signature.hash).toMatch(/^[a-f0-9]{64}$/); expect(signature.bytes.length).toBeLessThan(256*1024);
  });
  it('rejects blank drawings, non-PNG, oversized input and malformed base64', async () => {
    for (const input of [await png(true),'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,'+'A'.repeat(400000),'data:image/png;base64,%%%']) {
      await expect(normalizeCountingSignature(input)).rejects.toMatchObject({ code: 'count_signature_invalid' });
    }
  });
});
