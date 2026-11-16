import type { PublicTripDetail } from '@/lib/trip-settlement-route';
import { COUNT_CATEGORIES,countCategories } from '@/lib/trip-counting-contract';
export const tripMoney = (cents: number) => new Intl.NumberFormat('pt-BR',{ style: 'currency',currency: 'BRL' }).format(cents/100);
export const tripWarning: Record<string,string> = {
  incomplete_vehicle_count: 'A contagem ainda não terminou. O cálculo usa somente os veículos concluídos até agora.',
  online_adult_count_exceeds_vehicle_count: 'Os adultos pagos no site superam os adultos contados. Confira a contagem ou marque quem não veio para reembolso.',
  online_child_count_exceeds_vehicle_count: 'As crianças pagas no site superam as crianças contadas. Confira a contagem ou marque quem não veio para reembolso.',
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
      ].map(([label,cents]) => <div key={label} className="space-y-1"><dt className="text-sm text-[#45647f]">{label}</dt><dd className="text-xl font-semibold tabular-nums">{tripMoney(cents as number)}</dd></div>)}</dl>
      <dl className="divide-y divide-[#d4dfeb]">
        {(['adult','child'] as const).map(category => <div key={category} className="flex justify-between gap-4 py-3"><dt>{category === 'adult' ? 'Adultos contados no app' : 'Crianças contadas no app'}<small className="block text-[#45647f]">{(source.participants ?? []).filter(p => p.category === category && !p.refundRequested).length} pagaram no site e vieram · {category === 'adult' ? source.configuration.adultCourtesies : source.configuration.childCourtesies} cortesia(s)</small></dt><dd className="font-semibold tabular-nums">{calc.counts[category]}</dd></div>)}
        <div className="flex justify-between gap-4 py-3"><dt>Não cobrados<small className="block text-[#45647f]">Coordenadores, PCD e acompanhantes, filhos de professor e isentos</small></dt><dd className="tabular-nums">{calc.notChargedCount}</dd></div>
        <div className="flex justify-between gap-4 py-3"><dt>Adultos a cobrar<small className="block text-[#45647f]">{calc.adultToCharge} × {tripMoney(source.configuration.adultPriceCents!)}</small></dt><dd className="tabular-nums">{tripMoney(calc.adultToCharge * source.configuration.adultPriceCents!)}</dd></div>
        <div className="flex justify-between gap-4 py-3"><dt>Crianças a cobrar<small className="block text-[#45647f]">{calc.childToCharge} × {tripMoney(source.configuration.childPriceCents!)}</small></dt><dd className="tabular-nums">{tripMoney(calc.childToCharge * source.configuration.childPriceCents!)}</dd></div>
        <div className="flex justify-between gap-4 py-3 font-semibold"><dt>Total do passeio</dt><dd className="tabular-nums">{tripMoney(calc.totalTripCents)}</dd></div>
        <div className="flex justify-between gap-4 py-3"><dt>Menos já pagos no site e presentes</dt><dd className="tabular-nums">− {tripMoney(calc.onlinePresentCents)}</dd></div>
        <div className="flex justify-between gap-4 py-3 text-lg font-bold"><dt>A cobrar da escola</dt><dd className="tabular-nums">{tripMoney(calc.schoolChargeCents)}</dd></div>
      </dl>
      <p className="text-sm">Reembolsos de ausentes: <strong>{tripMoney(calc.refundsDueCents)}</strong>. A devolução deve ser realizada e registrada separadamente.</p>
      {source.pendingPaymentCents > 0 && <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950">Boleto a receber: {tripMoney(source.pendingPaymentCents)}. O registro do boleto não confirma recebimento e não libera a finalização.</p>}
      <details><summary className="min-h-11 cursor-pointer py-3 font-semibold">Contagem por categoria</summary><dl className="grid gap-2 sm:grid-cols-2">{countCategories.map(category => <div key={category} className="flex justify-between gap-3 border-b border-[#d4dfeb] py-2"><dt>{COUNT_CATEGORIES[category].label}</dt><dd className="font-semibold tabular-nums">{calc.counts[category]}</dd></div>)}</dl><p className="mt-3 text-sm">Cortesias: {source.configuration.adultCourtesies} adulto(s) e {source.configuration.childCourtesies} criança(s). Categorias não cobradas: {calc.notChargedCount} pessoa(s).</p></details>
    </>}
  </div>;
}
