export const TRIP_PAYMENT_METHODS = { pix: 'Pix',dinhe: 'Dinheiro',trans: 'Transferência',bolet: 'Boleto',credi: 'Cartão de crédito',debit: 'Cartão de débito' } as const;
export type TripPaymentMethod = keyof typeof TRIP_PAYMENT_METHODS;
export type TripFinancialActor = { name: string | null; cpf: string | null; manager: boolean };
export type TripConfiguration = { adultPriceCents: number; childPriceCents: number; adultCourtesies: number; childCourtesies: number };
export type TripPaymentInput = { method: TripPaymentMethod; amountCents: number; status: 'pending' | 'confirmed'; reference: string };
export type AllocatedTripPayment = TripPaymentInput & { tenderedCents: number; changeCents: number };
export class TripSettlementError extends Error { constructor(readonly code: string,message: string,readonly status = 409) { super(message); } }
export function invalidTrip(message = 'Confira os dados do fechamento.'): never { throw new TripSettlementError('trip_invalid_input',message,400); }
export function tripRecord(value: unknown,keys: readonly string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) return invalidTrip();
  return value as Record<string,unknown>;
}
export function tripText(value: unknown,max: number,required = false): string {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value) || (required && !value.trim())) return invalidTrip();
  return value.trim();
}
export function tripInteger(value: unknown,max = 9999999999,min = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) return invalidTrip('Informe valores inteiros dentro do limite permitido.'); return value;
}
export function normalizeTripConfiguration(value: unknown): TripConfiguration {
  const row = tripRecord(value,['adultPriceCents','childPriceCents','adultCourtesies','childCourtesies']);
  return { adultPriceCents: tripInteger(row.adultPriceCents),childPriceCents: tripInteger(row.childPriceCents),adultCourtesies: tripInteger(row.adultCourtesies,100000),childCourtesies: tripInteger(row.childCourtesies,100000) };
}
export function allocateTripPayments(balanceCents: number,value: unknown): { rows: AllocatedTripPayment[]; confirmedCents: number; remainingCents: number; changeCents: number } {
  tripInteger(balanceCents);
  if (!Array.isArray(value) || value.length < 1 || value.length > 20 || balanceCents === 0) return invalidTrip('Informe pagamentos somente quando houver saldo a receber.');
  const rows: AllocatedTripPayment[] = value.map(raw => {
    const row = tripRecord(raw,['method','amountCents','status','reference']),method = String(row.method) as TripPaymentMethod;
    if (!Object.hasOwn(TRIP_PAYMENT_METHODS,method) || !['confirmed','pending'].includes(String(row.status)) || (row.status === 'pending' && method !== 'bolet')) return invalidTrip();
    const amountCents = tripInteger(row.amountCents,9999999999,1),reference = tripText(row.reference,200,method !== 'dinhe' && row.status === 'confirmed');
    return { method,amountCents,tenderedCents: amountCents,changeCents: 0,status: row.status as 'pending' | 'confirmed',reference };
  });
  const confirmed = tripInteger(rows.filter(row => row.status === 'confirmed').reduce((sum,row) => sum+row.amountCents,0));
  const changeCents = Math.max(0,confirmed-balanceCents);
  let changeRemaining = changeCents;
  for (const row of [...rows].reverse()) if (row.method === 'dinhe') { row.changeCents = Math.min(row.amountCents,changeRemaining); row.amountCents -= row.changeCents; changeRemaining -= row.changeCents; }
  if (changeRemaining || rows.some(row => row.amountCents === 0)) return invalidTrip('O excesso só pode ser devolvido do dinheiro entregue. Retire formas de pagamento sem valor líquido.');
  return { rows,confirmedCents: confirmed-changeCents,remainingCents: Math.max(0,balanceCents-confirmed),changeCents };
}
