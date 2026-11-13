import { getOperationalTripDay } from '@/lib/operational-trip-day';
import { renderOperationalTripReport } from '@/lib/operational-trip-report';
import { getCountingSignature } from '@/lib/trip-counting';
import { invalidTrip } from '@/lib/trip-settlement-contract';
import { runTripFinancialRoute } from '@/lib/trip-settlement-route';
export const runtime = 'nodejs';
export function GET(request: Request,context: { params: Promise<{ date: string }> }) {
  return runTripFinancialRoute(request,async actor => {
    if (new URL(request.url).search) return invalidTrip();
    const day = await getOperationalTripDay((await context.params).date),signatures = new Map<string,Buffer>(); let size = 0;
    if (actor.canReadSignatures) for (const trip of day.trips) for (const vehicle of (trip.receipt?.snapshot ?? trip.source).vehicles) {
      if (!vehicle.revisionId || vehicle.state !== 'completed' || (!actor.manager && vehicle.ownerCpf !== actor.cpf) || signatures.has(vehicle.revisionId)) continue;
      const signature = await getCountingSignature(vehicle.revisionId,actor); size += signature.bytes.length;
      if (size > 30*1024*1024) return invalidTrip('As assinaturas excedem o limite deste relatório. Consulte os passeios individualmente.');
      signatures.set(vehicle.revisionId,signature.bytes);
    }
    return new Response(new Uint8Array(await renderOperationalTripReport(day,actor.name,signatures)),{ headers: { 'Content-Type': 'application/pdf','Content-Disposition': `inline; filename="passeios-${day.date}.pdf"` } });
  });
}
