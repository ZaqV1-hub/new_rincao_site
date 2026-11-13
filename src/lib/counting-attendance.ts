import type { PoolClient } from 'pg';
import { getIngressoSistemaDbPool } from './ingresso-db';
import { getOperationalParkId } from './operational-day-contract';
import { TripCountingError } from './trip-counting-contract';
import { isCivilDate } from './operational-date';
export type CountingAttendance={date:string;sold:number;admitted:number;expected:number};
export async function readCountingAttendance(client:Pick<PoolClient,'query'>,date:string):Promise<CountingAttendance>{
  if(!isCivilDate(date))throw new TripCountingError('count_date','Data inválida.',400);
  const {rows:[row]}=await client.query<{sold:string;admitted:string}>(`WITH selected AS (
    SELECT idvoucher FROM voucher WHERE dtinicio_validade=$1::date UNION
    SELECT v.idvoucher FROM agenda a JOIN voucher v ON v.idagenda=a.idagenda WHERE a.dtagenda=$1::date AND v.dtinicio_validade IS NULL UNION
    SELECT idvoucher FROM voucher WHERE dtuso=$1::date)
    SELECT COUNT(*) FILTER(WHERE c.stcompra='conc' AND COALESCE(v.dtinicio_validade,a.dtagenda)=$1::date AND v.stusado IS DISTINCT FROM 'inv'
      AND (c.tpcompra IN ('ponli','bilhe') OR (c.tpcompra='reser' AND COALESCE(UPPER(TRIM(c.formapag)),'') NOT IN ('','N/A'))))::text AS sold,
      COUNT(*) FILTER(WHERE v.stusado='s' AND v.dtuso=$1::date)::text AS admitted
    FROM selected JOIN voucher v USING(idvoucher) JOIN compra c ON c.idcompra=v.idcompra JOIN agenda a ON a.idagenda=v.idagenda
    WHERE (v.parque_operacional IS NULL OR v.parque_operacional=$2) AND v.idescola IS NULL
      AND v.tpvoucher IN ('norma','infan','isent','corte') AND v.servico_id IS NULL AND a.tpagenda IN ('padra','promo')
      AND NOT EXISTS(SELECT 1 FROM agenda_extras ae WHERE ae.idagenda=a.idagenda)`,[date,getOperationalParkId()]);
  const sold=Number(row.sold),admitted=Number(row.admitted);
  if(![sold,admitted].every(n=>Number.isSafeInteger(n)&&n>=0))throw new Error('invalid_attendance');
  return {date,sold,admitted,expected:Math.max(0,sold-admitted)};
}
export async function getCountingAttendance(date:string){return readCountingAttendance(getIngressoSistemaDbPool(),date);}
