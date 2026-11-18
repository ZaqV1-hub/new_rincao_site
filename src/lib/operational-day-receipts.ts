import type {PoolClient} from 'pg';
import type {OperationalParkId} from './operational-day-contract';
import {tripInteger} from './trip-settlement-contract';
export async function readOperationalDayReceipts(client:Pick<PoolClient,'query'>,date:string,park:OperationalParkId){
  const {rows:[schema]}=await client.query<{hasPaymentDate:boolean}>(`SELECT EXISTS (
    SELECT 1 FROM pg_attribute WHERE attrelid='compra'::regclass AND attname='dtpagamento'
      AND atttypid='date'::regtype AND NOT attisdropped
  ) AS "hasPaymentDate"`);
  // Avoid serializing every historical purchase when the legacy column is a native date.
  // Schemas without that column retain the existing unavailable-evidence behavior.
  const paidDate=schema.hasPaymentDate?"to_jsonb(c.dtpagamento)#>>'{}'":"to_jsonb(c)->>'dtpagamento'";
  const paidToday=schema.hasPaymentDate?'c.dtpagamento=$2::date':`${paidDate}=$2::date::text`;
  const rows=(await client.query<{source:string;method:string;amount:string|null;unknown:string}>(`WITH visit_purchases AS MATERIALIZED (
    SELECT v.idcompra FROM voucher v JOIN agenda a ON a.idagenda=v.idagenda
      WHERE v.dtinicio_validade=$2::date AND (v.parque_operacional IS NULL OR v.parque_operacional=$1)
    UNION SELECT v.idcompra FROM agenda a JOIN voucher v ON v.idagenda=a.idagenda
      WHERE a.dtagenda=$2::date AND v.dtinicio_validade IS NULL AND (v.parque_operacional IS NULL OR v.parque_operacional=$1)
  ), candidates AS MATERIALIZED (
    SELECT c.idcompra,${paidDate} AS paid_date FROM compra c
    WHERE c.tpcompra='ponli' AND c.stcompra='conc'
      AND (${paidToday} OR (${paidDate} IS NULL AND c.idcompra IN (SELECT idcompra FROM visit_purchases)))
  ), online AS (
    SELECT c.idcompra,c.paid_date,p."grossAmount"*100 AS cents,
      CASE p.paymentmethodtype WHEN 1 THEN 'credi' WHEN 2 THEN 'bolet' WHEN 11 THEN 'pix' ELSE 'não classificado' END AS method,
      EXISTS(SELECT 1 FROM visit_purchases v WHERE v.idcompra=c.idcompra) AS visits_today
    FROM candidates c LEFT JOIN LATERAL (SELECT "grossAmount",paymentmethodtype FROM pagpagseguro WHERE idcompra=c.idcompra AND status IN (2,3,4) ORDER BY "lastEventDate" DESC NULLS LAST,idpagseguro DESC LIMIT 1) p ON TRUE
    WHERE EXISTS(SELECT 1 FROM voucher v WHERE v.idcompra=c.idcompra AND (v.parque_operacional IS NULL OR v.parque_operacional=$1))
  )
  SELECT 'online' AS source,method,COALESCE(SUM(cents) FILTER(WHERE cents>=0 AND cents=TRUNC(cents)),0)::text AS amount,COUNT(*) FILTER(WHERE cents IS NULL OR cents<0 OR cents<>TRUNC(cents))::text AS unknown FROM online WHERE paid_date=$2::date::text GROUP BY method
  UNION ALL SELECT 'undated_online','não classificado',NULL,COUNT(*)::text FROM online WHERE paid_date IS NULL AND visits_today
  UNION ALL SELECT 'cash',btrim(p.forma_pagamento),SUM(p.valor*100)::text,'0' FROM compra_pagamentos p JOIN caixa_periodos c ON c.id=p.periodo_id WHERE c.parque=$1 AND (p.recebido_em AT TIME ZONE 'America/Sao_Paulo')::date=$2::date GROUP BY btrim(p.forma_pagamento)
  UNION ALL SELECT 'trips',method,SUM(amount_cents)::text,'0' FROM passeio_recebimentos WHERE parque=$1 AND payment_date=$2::date AND status='confirmed' GROUP BY method ORDER BY source,method`,[park,date])).rows;
  return {rows:rows.filter(r=>r.amount!==null).map(r=>({source:r.source,method:r.method,amountCents:tripInteger(Number(r.amount),Number.MAX_SAFE_INTEGER)})),unclassifiedCount:rows.reduce((sum,r)=>sum+tripInteger(Number(r.unknown),Number.MAX_SAFE_INTEGER),0)};
}
