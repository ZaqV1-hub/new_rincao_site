import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect,it } from 'vitest';
import { TripSettlementSummary } from './trip-settlement-summary';
import type { PublicTripDetail } from '@/lib/trip-settlement-route';
it('shows confirmed receipts separately from pending boleto and the amount still due',() => {
  const source = { configuration: { adultPriceCents: 10000,childPriceCents: 8000,adultCourtesies: 2,childCourtesies: 3 },
    calculation: { adultToCharge: 13,childToCharge: 17,onlinePresentCents: 130000,refundsDueCents: 8000,schoolChargeCents: 266000,totalTripCents: 396000,notChargedCount: 0,counts: { adult: 20,child: 30,coordinator: 0,pcdChild: 0,pcdAdult: 0,pcdCompanion: 0,teacherChild: 0,exempt: 0 } },
    confirmedCents: 100000,remainingCents: 166000,pendingPaymentCents: 166000,blockingIssues: [],warnings: [] } as unknown as PublicTripDetail['source'];
  const html = renderToStaticMarkup(<TripSettlementSummary source={source} />);
  expect(html).toContain('2.660,00'); expect(html).toContain('3.960,00'); expect(html).toContain('1.660,00'); expect(html).toContain('Boleto a receber'); expect(html).toContain('não confirma recebimento');
});
it('never renders unavailable calculation as a zero balance',() => {
  const source = { calculation: null,blockingIssues: ['Classifique o ingresso #18.'],warnings: [],confirmedCents: 0,pendingPaymentCents: 0,remainingCents: null } as unknown as PublicTripDetail['source'];
  const html = renderToStaticMarkup(<TripSettlementSummary source={source} />);
  expect(html).toContain('Cálculo indisponível'); expect(html).toContain('Classifique o ingresso #18.'); expect(html).not.toContain('R$');
});
