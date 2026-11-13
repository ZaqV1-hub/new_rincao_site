import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getOperationalParkId } from './operational-day-contract';
import { readCashAmountCents } from './ops-box-office-sales';
import { countCategories,normalizeCountDraft,type CountCategory,type CountDraft } from './trip-counting-contract';
import { calculateTripSettlement,type TripSettlementResult,type TripSettlementVehicle } from './trip-settlement-calculation';
import { TripSettlementError,type TripConfiguration,type TripPaymentMethod } from './trip-settlement-contract';
export type TripKey = { agendaId: number; clientId: number };
export type TripFinancialVehicle = { id: number; type: string; version: number; state: string; plannedPeople: number | null; revisionId: string | null;
  ownerName: string | null; ownerCpf: string | null; addedOnDay: boolean; addedByName: string | null; completedAt: string | null; draft: CountDraft | null };
export type TripOnlineParticipant = { voucherId: number; purchaseId: number; name: string; category: CountCategory | null; paidCents: number;
  refundRequested: boolean; refundPaidCents: number | null; refundPaidAt: string | null; invalidated: boolean; held: boolean };
export type TripPayment = { id: number; method: TripPaymentMethod; amountCents: number; tenderedCents: number; changeCents: number; status: string;
  paymentDate: string; periodId: number | null; reference: string | null; confirmedAt: string | null; reversed: boolean };
export type TripSettlementSource = TripKey & { park: string; date: string; today: string; closed: boolean; cancelled: boolean; clientName: string;
  representative: string | null; transportName: string | null; transportPhone: string | null; plannedPeople: number | null; contact: string | null; phone: string | null; boardingTime: string | null; observations: string | null;
  financialVersion: number; configuration: Omit<TripConfiguration,'adultPriceCents' | 'childPriceCents'> & { adultPriceCents: number | null; childPriceCents: number | null };
  sitePrices: { adultPriceCents: number | null; childPriceCents: number | null }; vehicles: TripFinancialVehicle[]; participants: TripOnlineParticipant[];
  payments: TripPayment[]; calculation: TripSettlementResult | null; confirmedCents: number; remainingCents: number | null; pendingPaymentCents: number;
  blockingIssues: string[]; warnings: string[]; fingerprint: string; receiptId: string | null };
function number(value: unknown,max = Number.MAX_SAFE_INTEGER): number {
  const parsed = Number(value); if (value === null || !Number.isSafeInteger(parsed) || parsed < 0 || parsed > max) throw new TripSettlementError('trip_invalid_data','Há dados financeiros que precisam de conferência.'); return parsed;
}
function amount(value: unknown): number { if (value === null) throw new TripSettlementError('trip_invalid_amount','Há um ingresso pago sem valor comprovado.'); return readCashAmountCents(value); }
export function tripFingerprint(value: unknown) { return createHash('sha256').update(JSON.stringify(value,(_key,item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key,item[key]])) : item)).digest('hex'); }
export async function readTripSettlementSource(client: PoolClient,key: TripKey): Promise<TripSettlementSource> {
  const park = getOperationalParkId(),args = [park,key.agendaId,key.clientId];
  const trip = (await client.query<{ date: string; today: string; closed: boolean; cancelled: boolean; clientName: string; plannedPeople: number | null;
    contact: string | null; phone: string | null; transportName: string | null; transportPhone: string | null; boardingTime: string | null; observations: string | null; version: number; adultPrice: string | null; childPrice: string | null;
    adultCourtesies: number; childCourtesies: number; siteAdult: string | null; siteChild: string | null; receiptId: string | null }>(`SELECT a.dtagenda::text AS date,
    (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text AS today,
    EXISTS(SELECT 1 FROM operacao_dias d WHERE d.parque=$1 AND d.data=a.dtagenda AND d.estado='closed') AS closed,
    (btrim(COALESCE(a.stagenda,'')) IN ('can','canc','ina','inat') OR btrim(COALESCE(to_jsonb(ae)->>'stagenda_cli','')) IN ('can','canc','ina','inat')) AS cancelled,
    c.nome AS "clientName",o.planned_people AS "plannedPeople",o.contato AS contact,o.telefone AS phone,CASE WHEN o.transport_mode='client' THEN 'Transporte do cliente' ELSE carrier.nome END AS "transportName",o.carrier_phone AS "transportPhone",o.boarding_time AS "boardingTime",o.observacoes AS observations,
    COALESCE(o.financial_version,1) AS version,o.adult_price_cents::text AS "adultPrice",o.child_price_cents::text AS "childPrice",COALESCE(o.adult_courtesies,0) AS "adultCourtesies",COALESCE(o.child_courtesies,0) AS "childCourtesies",
    p.vlnormal::text AS "siteAdult",p.vlinfant::text AS "siteChild",o.finalized_receipt_id AS "receiptId"
    FROM agenda_extras ae JOIN agenda a ON a.idagenda=ae.idagenda JOIN clientes c ON c.idcliente=ae.idcliente
    LEFT JOIN tabpreco p ON p.idtabpreco=a.idtabpreco LEFT JOIN passeio_operacao o ON o.parque=$1 AND o.agenda_id=ae.idagenda AND o.cliente_id=ae.idcliente
    LEFT JOIN transportadores carrier ON carrier.parque=o.parque AND carrier.id=o.carrier_id
    WHERE ae.idagenda=$2 AND ae.idcliente=$3`,args)).rows[0];
  if (!trip) throw new TripSettlementError('trip_not_found','Passeio não encontrado.',404);
  const bands = (await client.query<{ min: number; max: number; value: string; clientId: number | null }>(`SELECT idade_min AS min,idade_max AS max,valor::text AS value,idcliente AS "clientId" FROM agenda_faixas
    WHERE idagenda=$1 AND (idcliente=$2 OR idcliente IS NULL) ORDER BY idade_min,idade_max,idfaixa`,[key.agendaId,key.clientId])).rows;
  const specific = bands.filter(row => row.clientId === key.clientId),chosen = specific.length ? specific : bands.filter(row => row.clientId === null);
  function bandPrice(min: number,max: number,table: string | null) {
    if (!chosen.length) return table === null ? null : amount(table);
    const applicable = chosen.filter(row => row.max >= min && row.min <= max);
    if (!applicable.length || applicable[0].min > min || applicable.at(-1)!.max < max) return null;
    let end = min-1; const prices = new Set<number>();
    for (const row of applicable) { if (row.min > end+1) return null; end = Math.max(end,row.max); prices.add(amount(row.value)); }
    return prices.size === 1 ? [...prices][0] : null;
  }
  const sitePrices = { adultPriceCents: bandPrice(10,120,trip.siteAdult),childPriceCents: bandPrice(4,9,trip.siteChild) };
  const configuration = { adultPriceCents: trip.adultPrice === null ? sitePrices.adultPriceCents : number(trip.adultPrice),childPriceCents: trip.childPrice === null ? sitePrices.childPriceCents : number(trip.childPrice),adultCourtesies: trip.adultCourtesies,childCourtesies: trip.childCourtesies };
  const availability = (await client.query("SELECT to_regclass('contrato_escolar_agendamento') IS NOT NULL AS contract,to_regclass('commerce_school_payment_hold') IS NOT NULL AS holds")).rows[0];
  const representative = availability.contract ? (await client.query<{ name: string }>(`SELECT representante_nome AS name FROM contrato_escolar_agendamento WHERE agenda_id=$1 AND cliente_id=$2 AND status='agendado' ORDER BY confirmado_em DESC NULLS LAST,idcontrato DESC LIMIT 1`,[key.agendaId,key.clientId])).rows[0]?.name ?? null : null;
  const rawVehicles = (await client.query<{ id: string; type: string; version: number; state: string; plannedPeople: number | null; revisionId: string | null; ownerName: string | null; ownerCpf: string | null;
    addedOnDay: boolean; addedByName: string | null; completedAt: string | null; revisionStatus: string | null; counts: CountDraft['counts']; pcdDetails: CountDraft['pcdDetails']; notes: string; responsibleName: string; responsiblePhone: string; confirmed: boolean }>(`SELECT v.id::text,v.tipo AS type,v.versao AS version,v.estado AS state,v.planned_people AS "plannedPeople",v.added_on_day AS "addedOnDay",
    (SELECT e.usuario_nome FROM edicoes_log e WHERE e.origem IN ('painel-contagem','painel-programacao') AND e.detalhes_json::jsonb->>'actorCpf'=v.created_by ORDER BY e.id DESC LIMIT 1) AS "addedByName",n.id AS "revisionId",n.owner_name AS "ownerName",n.owner_cpf AS "ownerCpf",
    n.completed_at::text AS "completedAt",n.status AS "revisionStatus",n.counts,n.pcd_details AS "pcdDetails",n.notes,n.responsible_name AS "responsibleName",n.responsible_phone AS "responsiblePhone",n.contact_confirmed AS confirmed
    FROM passeio_veiculos v LEFT JOIN passeio_contagens n ON n.id=v.current_count_id AND n.parque=v.parque
    WHERE v.parque=$1 AND v.agenda_id=$2 AND v.cliente_id=$3 ORDER BY v.id`,args)).rows;
  const vehicles: TripFinancialVehicle[] = rawVehicles.map(row => ({ id: number(row.id),type: row.type,version: row.version,state: row.state,plannedPeople: row.plannedPeople,revisionId: row.revisionId,ownerName: row.ownerName,ownerCpf: row.ownerCpf,addedOnDay: row.addedOnDay,addedByName: row.addedByName,completedAt: row.completedAt,
    draft: row.revisionId ? normalizeCountDraft({ counts: row.counts,pcdDetails: row.pcdDetails,notes: row.notes,responsible: { name: row.responsibleName,phone: row.responsiblePhone,confirmed: row.confirmed } },row.state === 'completed') : null }));
  if (rawVehicles.some(row => row.state === 'completed' && row.revisionStatus !== 'completed')) throw new TripSettlementError('trip_invalid_count','Um veículo concluído não possui revisão válida.');
  const rawParticipants = (await client.query<{ voucherId: number; purchaseId: number; name: string; ticketType: string; category: CountCategory | null; paid: string | null;
    refundRequested: boolean; refundPaid: string | null; refundPaidAt: string | null; invalidated: boolean; held: boolean }>(`SELECT v.idvoucher AS "voucherId",v.idcompra AS "purchaseId",
    COALESCE(NULLIF(to_jsonb(v)->>'nomeeducador',''),NULLIF(to_jsonb(v)->>'nomealuno',''),NULLIF(to_jsonb(v)->>'identificacao',''),'Participante sem nome') AS name,
    btrim(v.tpvoucher) AS "ticketType",p.category,v.vlunicompra::text AS paid,COALESCE(p.refund_requested,false) AS "refundRequested",p.refund_paid_cents::text AS "refundPaid",p.refund_paid_at::text AS "refundPaidAt",
    v.stusado='inv' AS invalidated,${availability.holds ? "(EXISTS(SELECT 1 FROM commerce_school_payment_hold h WHERE h.order_id=c.idcompra AND h.status<>'released') OR ((to_jsonb(c)->'checkout_school_site_context') IS NOT NULL AND (to_jsonb(c)->'checkout_school_site_context')<>'null'::jsonb AND NOT EXISTS(SELECT 1 FROM commerce_school_payment_hold h WHERE h.order_id=c.idcompra)))" : "(COALESCE(to_jsonb(c)->'checkout_school_site_context','null'::jsonb)<>'null'::jsonb)"} AS held
    FROM voucher v JOIN compra c ON c.idcompra=v.idcompra LEFT JOIN passeio_participantes p ON p.parque=$1 AND p.voucher_id=v.idvoucher AND p.agenda_id=$2 AND p.cliente_id=$3
    WHERE v.idagenda=$2 AND v.idescola=$3 AND btrim(c.stcompra)='conc' AND btrim(c.tpcompra)='ponli' AND v.servico_id IS NULL AND (v.parque_operacional IS NULL OR v.parque_operacional=$1) ORDER BY v.idvoucher`,args)).rows;
  const participants: TripOnlineParticipant[] = rawParticipants.map(row => ({ voucherId: row.voucherId,purchaseId: row.purchaseId,name: row.name,
    category: ({ norma: 'adult',infan: 'child',isent: 'exempt' } as Record<string,CountCategory>)[row.ticketType] ?? row.category ?? null,paidCents: amount(row.paid),refundRequested: row.refundRequested,refundPaidCents: row.refundPaid === null ? null : number(row.refundPaid),refundPaidAt: row.refundPaidAt,invalidated: row.invalidated,held: row.held }));
  const payments = (await client.query<{ id: string; method: TripPaymentMethod; amountCents: string; tenderedCents: string; changeCents: string; status: string; paymentDate: string; periodId: number | null; reference: string | null; confirmedAt: string | null; reversed: boolean }>(`SELECT r.id::text,r.method,r.amount_cents::text AS "amountCents",r.tendered_cents::text AS "tenderedCents",r.change_cents::text AS "changeCents",r.status,r.payment_date::text AS "paymentDate",r.period_id AS "periodId",r.reference,r.confirmed_at::text AS "confirmedAt",EXISTS(SELECT 1 FROM passeio_recebimento_estornos e WHERE e.payment_id=r.id) AS reversed
    FROM passeio_recebimentos r WHERE r.parque=$1 AND r.agenda_id=$2 AND r.cliente_id=$3 ORDER BY r.id`,args)).rows.map(row => ({ ...row,id: number(row.id),amountCents: number(row.amountCents),tenderedCents: number(row.tenderedCents),changeCents: number(row.changeCents) }));
  const blockingIssues: string[] = [];
  if (configuration.adultPriceCents === null || configuration.childPriceCents === null) blockingIssues.push('Confira os preços adulto e criança: a origem não fornece um valor único para a faixa atual.');
  if (participants.some(row => row.category === null)) blockingIssues.push('Classifique os participantes pagos sem categoria comprovada antes de receber ou finalizar.');
  if (participants.some(row => row.held)) blockingIssues.push('Há pagamentos escolares retidos ou sem liberação comprovada. Resolva a retenção antes de finalizar.');
  if (participants.some(row => row.invalidated && !row.refundRequested)) blockingIssues.push('Há ingressos pagos invalidados ainda tratados como presentes. Confira os reembolsos.');
  const calculation = blockingIssues.length ? null : calculateTripSettlement({ ...configuration as TripConfiguration,vehicles: vehicles.map(v => ({ id: v.id,status: ({ waiting: 'aguardando',counting: 'contando',completed: 'concluido' } as const)[v.state as 'waiting' | 'counting' | 'completed'],counts: Object.fromEntries(countCategories.map(category => [category,v.state === 'completed' ? v.draft!.counts[category] : 0])) as TripSettlementVehicle['counts'] })),onlineParticipants: participants.map(p => ({ voucherId: p.voucherId,category: p.category!,paidCents: p.paidCents,refundRequested: p.refundRequested })) });
  const confirmedCents = number(payments.filter(row => row.status === 'confirmed' && !row.reversed).reduce((sum,row) => sum+row.amountCents,0));
  const pendingPaymentCents = number(payments.filter(row => row.status === 'pending').reduce((sum,row) => sum+row.amountCents,0));
  const warnings = [...(calculation?.warnings ?? []),...(!vehicles.length ? ['no_vehicles'] : []),...(calculation && confirmedCents > calculation.schoolChargeCents ? ['overpaid_school'] : [])];
  const stable = { ...key,park,date: trip.date,cancelled: trip.cancelled,clientName: trip.clientName,representative,transportName: trip.transportName,transportPhone: trip.transportPhone,plannedPeople: trip.plannedPeople,contact: trip.contact,phone: trip.phone,boardingTime: trip.boardingTime,observations: trip.observations,
    financialVersion: trip.version,configuration,sitePrices,vehicles,participants,payments,calculation,confirmedCents,pendingPaymentCents,remainingCents: calculation ? calculation.schoolChargeCents-confirmedCents : null,blockingIssues,warnings,receiptId: trip.receiptId };
  return { ...stable,today: trip.today,closed: trip.closed,fingerprint: tripFingerprint(stable) };
}
