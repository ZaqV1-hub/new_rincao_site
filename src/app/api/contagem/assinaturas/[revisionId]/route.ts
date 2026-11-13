import { getCountingSignature } from '@/lib/trip-counting';
import { runCountingRoute } from '@/lib/trip-counting-route';
export const runtime = 'nodejs';
export function GET(request: Request,context: { params: Promise<{ revisionId: string }> }) {
  return runCountingRoute(request,async actor => {
    const signature = await getCountingSignature((await context.params).revisionId,actor);
    return new Response(new Uint8Array(signature.bytes),{ headers: { 'Content-Type': 'image/png','Content-Disposition': 'inline; filename="assinatura.png"' } });
  });
}
