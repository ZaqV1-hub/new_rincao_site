import { getTripReceipt } from '@/lib/trip-settlement';
import { invalidTrip } from '@/lib/trip-settlement-contract';
import { runTripFinancialRoute } from '@/lib/trip-settlement-route';
import { renderTripReceiptPdf } from '@/lib/trip-receipt-pdf';
export const runtime = 'nodejs';
export function GET(request: Request,context: { params: Promise<{ receiptId: string }> }) {
  return runTripFinancialRoute(request,async () => {
    if (new URL(request.url).search) return invalidTrip();
    const receipt = await getTripReceipt((await context.params).receiptId);
    return new Response(new Uint8Array(await renderTripReceiptPdf(receipt)),{ headers: { 'Content-Type': 'application/pdf','Content-Disposition': `inline; filename="recibo-passeio-${receipt.number}.pdf"` } });
  });
}
