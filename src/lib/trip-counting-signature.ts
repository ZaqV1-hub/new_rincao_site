import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { TripCountingError } from './trip-counting-contract';

export type CountingSignature = { bytes: Buffer; hash: string; width: number; height: number };
function invalid(): never { throw new TripCountingError('count_signature_invalid','Desenhe uma assinatura válida em PNG de até 256 KB.',400); }
export async function normalizeCountingSignature(value: unknown): Promise<CountingSignature> {
  if (typeof value !== 'string' || value.length > 350000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return invalid();
  const source = Buffer.from(value.slice('data:image/png;base64,'.length),'base64');
  if (source.length > 256*1024 || !source.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return invalid();
  try {
    const image = sharp(source,{ limitInputPixels: 1000000,failOn: 'error' });
    const metadata = await image.metadata();
    if (metadata.format !== 'png' || !metadata.width || !metadata.height || metadata.width < 3 || metadata.height < 3 || (metadata.pages ?? 1) !== 1) return invalid();
    const bytes = await image.flatten({ background: '#ffffff' }).removeAlpha().png().toBuffer();
    if (bytes.length > 256*1024) return invalid();
    const stats = await sharp(bytes).stats();
    if (!stats.channels.some(channel => channel.min < 240 && channel.max > 250 && channel.stdev > 1)) return invalid();
    return { bytes,hash: createHash('sha256').update(bytes).digest('hex'),width: metadata.width,height: metadata.height };
  } catch { return invalid(); }
}
