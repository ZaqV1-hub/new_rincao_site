import type {PoolClient} from 'pg';
import type {OperationalParkId} from './operational-day-contract';
import {tripInteger} from './trip-settlement-contract';
export async function readOperationalDayReceipts(client:Pick<PoolClient,'query'>,date:string,park:OperationalParkId){
  const rows=(await client.query<{source:string;method:string;amount:string|null;unknown:string}>(`WITH online AS (
    SELECT c.idcompra,to_jsonb(c)->>'dtpagamento' AS paid_date,p."grossAmount"*100 AS cents,
      CASE p.paymentmethodtype WHEN 1 THEN 'credi' WHEN 2 THEN 'bolet' WHEN 11 THEN 'pix' ELSE 'não classificado' END AS method,
      EXISTS(SELECT 1 FROM voucher v JOIN agenda a ON a.idagenda=v.idagenda WHERE v.idcompra=c.idcompra AND COALESCE(v.dtinicio_validade,a.dtagenda)=$2::date AND (v.parque_operacional IS NULL OR v.parque_operacional=$1)) AS visits_today
    FROM compra c LEFT JOIN LATERAL (SELECT "grossAmount",paymentmethodtype FROM pagpagseguro WHERE idcompra=c.idcompra AND status IN (2,3,4) ORDER BY "lastEventDate" DESC NULLS LAST,idpagseguro DESC LIMIT 1) p ON TRUE
    WHERE c.tpcompra='ponli' AND c.stcompra='conc' AND EXISTS(SELECT 1 FROM voucher v WHERE v.idcompra=c.idcompra AND (v.parque_operacional IS NULL OR v.parque_operacional=$1))
  )
  SELECT 'online' AS source,method,COALESCE(SUM(cents) FILTER(WHERE cents>=0 AND cents=TRUNC(cents)),0)::text AS amount,COUNT(*) FILTER(WHERE cents IS NULL OR cents<0 OR cents<>TRUNC(cents))::text AS unknown FROM online WHERE paid_date=$2::date::text GROUP BY method
  UNION ALL SELECT 'undated_online','não classificado',NULL,COUNT(*)::text FROM online WHERE paid_date IS NULL AND visits_today
  UNION ALL SELECT 'cash',btrim(p.forma_pagamento),SUM(p.valor*100)::text,'0' FROM compra_pagamentos p JOIN caixa_periodos c ON c.id=p.periodo_id WHERE c.parque=$1 AND (p.recebido_em AT TIME ZONE 'America/Sao_Paulo')::date=$2::date GROUP BY btrim(p.forma_pagamento)
  UNION ALL SELECT 'trips',method,SUM(amount_cents)::text,'0' FROM passeio_recebimentos WHERE parque=$1 AND payment_date=$2::date AND status='confirmed' GROUP BY method ORDER BY source,method`,[park,date])).rows;
  return {rows:rows.filter(r=>r.amount!==null).map(r=>({source:r.source,method:r.method,amountCents:tripInteger(Number(r.amount),Number.MAX_SAFE_INTEGER)})),unclassifiedCount:rows.reduce((sum,r)=>sum+tripInteger(Number(r.unknown),Number.MAX_SAFE_INTEGER),0)};
}
