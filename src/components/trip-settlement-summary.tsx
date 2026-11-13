import type { PublicTripDetail } from '@/lib/trip-settlement-route';
import { COUNT_CATEGORIES,countCategories } from '@/lib/trip-counting-contract';
export const tripMoney = (cents: number) => new Intl.NumberFormat('pt-BR',{ style: 'currency',currency: 'BRL' }).format(cents/100);
export const tripWarning: Record<string,string> = {
  incomplete_vehicle_count: 'Há veículos com contagem incompleta.',
  online_adult_count_exceeds_vehicle_count: 'Os adultos pagos no site superam os adultos contados.',
  online_child_count_exceeds_vehicle_count: 'As crianças pagas no site superam as crianças contadas.',
  no_vehicles: 'Nenhum veículo foi registrado neste passeio.',
  overpaid_school: 'Os recebimentos superam a cobrança atual. Confira a devolução antes de finalizar.',
};
export function TripSettlementSummary({ source }: { source: PublicTripDetail['source'] }) {
  const calc = source.calculation;
  return <div className="space-y-4">
    {source.blockingIssues.length > 0 && <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950"><p className="font-semibold">Cálculo indisponível</p><ul className="list-disc pl-5">{source.blockingIssues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
    {source.warnings.length > 0 && <ul className="list-disc rounded-lg border border-amber-300 bg-amber-50 p-3 pl-8 text-amber-950">{source.warnings.map(warning => <li key={warning}>{tripWarning[warning] ?? warning}</li>)}</ul>}
    {calc && <>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
        ['Cobrança da escola',calc.schoolChargeCents],['Recebido da escola',source.confirmedCents],['Falta receber',source.remainingCents!],['Total do passeio',calc.totalTripCents],
      ].map(([label,cents]) => <div key={label} className="border-l-2 border-[#a7c4db] pl-3"><dt className="text-sm text-[#45647f]">{label}</dt><dd className="text-xl font-semibold tabular-nums">{tripMoney(cents as number)}</dd></div>)}</dl>
      <p className="text-sm">Adultos a cobrar: {calc.adultToCharge} × {tripMoney(source.configuration.adultPriceCents!)}. Crianças a cobrar: {calc.childToCharge} × {tripMoney(source.configuration.childPriceCents!)}.</p>
      <p className="text-sm">Pagos no site e presentes: {tripMoney(calc.onlinePresentCents)} · Reembolsos de ausentes: {tripMoney(calc.refundsDueCents)}. O total do passeio soma a cobrança da escola aos pagos no site presentes.</p>
      {source.pendingPaymentCents > 0 && <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950">Boleto a receber: {tripMoney(source.pendingPaymentCents)}. O registro do boleto não confirma recebimento e não libera a finalização.</p>}
      <details><summary className="min-h-11 cursor-pointer py-3 font-semibold">Contagem por categoria</summary><dl className="grid gap-2 sm:grid-cols-2">{countCategories.map(category => <div key={category} className="flex justify-between gap-3 border-b border-[#d4dfeb] py-2"><dt>{COUNT_CATEGORIES[category].label}</dt><dd className="font-semibold tabular-nums">{calc.counts[category]}</dd></div>)}</dl><p className="mt-3 text-sm">Cortesias: {source.configuration.adultCourtesies} adulto(s) e {source.configuration.childCourtesies} criança(s). Categorias não cobradas: {calc.notChargedCount} pessoa(s).</p></details>
    </>}
  </div>;
}
