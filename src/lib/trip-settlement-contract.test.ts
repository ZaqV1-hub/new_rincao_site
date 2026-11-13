import { describe,expect,it } from 'vitest';
import { allocateTripPayments,normalizeTripConfiguration } from './trip-settlement-contract';
const payment = (method: string,amountCents: number,status = 'confirmed') => ({ method,amountCents,status,reference: method === 'dinhe' ? '' : 'Comprovante 123' });
describe('trip payment allocation',() => {
  it('retains partial payment without turning pending boleto into received',() => {
    expect(allocateTripPayments(10000,[payment('pix',3000),payment('bolet',7000,'pending')])).toMatchObject({ confirmedCents: 3000,remainingCents: 7000,changeCents: 0 });
  });
  it('allocates change across cash only and keeps the exact received net',() => {
    const result = allocateTripPayments(10000,[payment('pix',7000),payment('dinhe',2000),payment('dinhe',3000)]);
    expect(result).toMatchObject({ confirmedCents: 10000,remainingCents: 0,changeCents: 2000 });
    expect(result.rows.map(row => row.amountCents)).toEqual([7000,2000,1000]);
  });
  it('rejects excess electronic payment and missing proof',() => {
    expect(() => allocateTripPayments(100,[payment('pix',101)])).toThrow();
    expect(() => allocateTripPayments(100,[{ ...payment('pix',100),reference: '' }])).toThrow();
  });
  it('does not accept a fake cash payment for a zero balance or invalid amounts',() => {
    for (const amount of [0,-1,1.2,NaN,Infinity,10000000000]) expect(() => allocateTripPayments(100,[payment('pix',amount)])).toThrow();
    expect(() => allocateTripPayments(0,[payment('dinhe',1)])).toThrow();
  });
  it('preserves explicit zero prices and requires all configuration fields',() => {
    expect(normalizeTripConfiguration({ adultPriceCents: 0,childPriceCents: 8000,adultCourtesies: 2,childCourtesies: 3 })).toEqual({ adultPriceCents: 0,childPriceCents: 8000,adultCourtesies: 2,childCourtesies: 3 });
    expect(() => normalizeTripConfiguration({ adultPriceCents: null,childPriceCents: 0,adultCourtesies: 0,childCourtesies: 0 })).toThrow();
    expect(() => normalizeTripConfiguration({ adultPriceCents: 0,childPriceCents: 0,adultCourtesies: 0,childCourtesies: 0,actorCpf:'forged' })).toThrow();
  });
});
