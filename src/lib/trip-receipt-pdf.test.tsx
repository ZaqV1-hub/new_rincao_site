import { expect,it } from 'vitest';
import { buildTripReceiptLines,renderTripReceiptPdf } from './trip-receipt-pdf';
import type { TripReceipt } from './trip-settlement';
const receipt = { id: '11111111-1111-1111-1111-111111111111',number: 42,actorName: 'Operador',createdAt: '2026-11-13T15:00:00Z',snapshot: {
  clientName: 'Escola de ensaio',date: '2026-11-13',representative: 'Representante de ensaio',vehicles: [{ id: 1,type: 'bus' }],
  configuration: { adultPriceCents: 10000,childPriceCents: 8000,adultCourtesies: 2,childCourtesies: 3 },
  calculation: { counts: { adult: 20,child: 30,coordinator: 2,pcdChild: 0,pcdAdult: 0,pcdCompanion: 0,teacherChild: 0,exempt: 0 },adultToCharge: 13,childToCharge: 17,onlinePresentCents: 130000,refundsDueCents: 0,schoolChargeCents: 266000,totalTripCents: 396000,notChargedCount: 2 },
  confirmedCents: 266000,remainingCents: 0,pendingPaymentCents: 0,payments: [{ id: 1,method: 'pix',status: 'confirmed',amountCents: 266000,paymentDate: '2026-11-13',reference: 'Comprovante 01',reversed: false }],warnings: [],blockingIssues: [],participants: [],
} } as unknown as TripReceipt;
it('prints the frozen receipt in two copies on A4 with signatures and all amounts',async () => {
  const lines = buildTripReceiptLines(receipt).join('\n');
  expect(lines).toContain('2.660,00'); expect(lines).toContain('3.960,00'); expect(lines).toContain('52'); expect(lines).toContain('Comprovante 01');
  const bytes = await renderTripReceiptPdf(receipt); const pdf = bytes.toString('latin1');
  expect(pdf.startsWith('%PDF-')).toBe(true); expect(pdf.match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
});
it('refuses a receipt without a fully confirmed settlement',() => {
  expect(() => buildTripReceiptLines({ ...receipt,snapshot: { ...receipt.snapshot,remainingCents: 1 } })).toThrow('incompleto');
});
