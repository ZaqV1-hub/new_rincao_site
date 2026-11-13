import type {PoolClient} from 'pg';
import {ownerDates,unavailableOwnerDay,type OwnerDay,type OwnerRange} from './owner-dashboard';
import {withOwnerSource} from './owner-sources';
import {isCivilDate} from './operational-date';
// Estância has no verified managerial daily closure. Cash drawer snapshots are not revenue snapshots.
export const ESTANCIA_OWNER_SALES_SQL=`WITH eligible AS (
 SELECT c.idcompra,c.tpcompra,c.vltotcompra,
   c.stcompra='conc' AND (c.tpcompra='ponli' OR (c.tpcompra IN ('bilhe','reser') AND coalesce(upper(trim(c.formapag)),'') NOT IN ('','N/A'))) AS paid
 FROM compra c WHERE EXISTS(SELECT 1 FROM voucher v JOIN agenda a ON a.idagenda=v.idagenda WHERE v.idcompra=c.idcompra AND (a.dtagenda BETWEEN $1::date AND $2::date OR v.dtuso BETWEEN $1::date AND $2::date))
), checked AS (
 SELECT c.idcompra,c.tpcompra,c.paid,
   c.vltotcompra IS NOT NULL AND c.vltotcompra>=0 AND SUM(v.vlunicompra)=c.vltotcompra AND bool_and(v.vlunicompra IS NOT NULL AND v.vlunicompra>=0 AND v.vlunicompra*100=trunc(v.vlunicompra*100)) AS reconciled
 FROM eligible c JOIN voucher v ON v.idcompra=c.idcompra GROUP BY c.idcompra,c.tpcompra,c.paid,c.vltotcompra
), facts AS (
 SELECT a.dtagenda AS date,v.dtuso,v.stusado,v.tpvoucher,v.idescola,a.tpagenda,c.tpcompra,c.paid,c.reconciled,v.vlunicompra*100 AS cents,
   CASE WHEN v.tpvoucher IN ('norma','infan','isent','corte','escol') THEN 'passport'
    WHEN v.tpvoucher='espec' THEN (SELECT CASE WHEN count(DISTINCT p.type)=1 THEN min(p.type) END FROM jsonb_to_recordset($3::jsonb) AS p(title text,type text) WHERE lower(trim(p.title))=lower(trim(v.descricao))) END AS kind
 FROM checked c JOIN voucher v ON v.idcompra=c.idcompra JOIN agenda a ON a.idagenda=v.idagenda
), dates AS (SELECT d::date AS day FROM generate_series($1::date,$2::date,interval '1 day') d)
 SELECT dates.day::text AS date,
   coalesce(sum(f.cents) FILTER(WHERE f.date=dates.day AND f.paid AND f.reconciled AND f.tpcompra='ponli'),0)::text AS site,
   coalesce(sum(f.cents) FILTER(WHERE f.date=dates.day AND f.paid AND f.reconciled AND f.tpcompra IN ('bilhe','reser')),0)::text AS gate,
   count(*) FILTER(WHERE f.date=dates.day AND f.paid AND f.reconciled IS DISTINCT FROM true)::text AS "unreconciled",
   count(*) FILTER(WHERE f.dtuso=dates.day AND f.stusado='s' AND f.kind='passport')::text AS admitted,
   count(*) FILTER(WHERE f.dtuso=dates.day AND f.stusado='s' AND f.kind IS NULL)::text AS "unknownAdmissions",
   EXISTS(SELECT 1 FROM agenda a WHERE a.dtagenda=dates.day AND a.stagenda IN ('abe','lot')) AS scheduled,
   EXISTS(SELECT 1 FROM agenda a JOIN agenda_extras ae ON ae.idagenda=a.idagenda WHERE a.dtagenda=dates.day) AS "schoolDay"
 FROM dates LEFT JOIN facts f ON f.date=dates.day OR f.dtuso=dates.day GROUP BY dates.day ORDER BY dates.day`;
type EstanciaRow={date:string;site:string;gate:string;unreconciled:string;admitted:string;unknownAdmissions:string;scheduled:boolean;schoolDay:boolean};
export async function readEstanciaFacts(client:Pick<PoolClient,'query'>,range:OwnerRange,products:{title:string;type:string}[]=[]){return (await client.query<EstanciaRow>(ESTANCIA_OWNER_SALES_SQL,[range.start,range.end,JSON.stringify(products)])).rows;}
async function readDayUseFacts(client:Pick<PoolClient,'query'>,range:OwnerRange){
 const raw=(await client.query<{products:unknown}>("SELECT content_json->'products' AS products FROM estancia_site_content WHERE content_key='main'")).rows[0]?.products;
 if(!Array.isArray(raw)||raw.length>5000)throw new Error('Product classification unavailable');
 const products=raw.filter(p=>p&&typeof p.title==='string'&&['passport','addon'].includes(p.type)).map(p=>({title:p.title,type:p.type}));
 return readEstanciaFacts(client,range,products);
}
function value(v:string){const n=Number(v);if(!Number.isSafeInteger(n)||n<0)throw new Error('Invalid Estância aggregate');return n;}
export async function readEstanciaOwnerDays(range:OwnerRange):Promise<OwnerDay[]>{
 const cutoff=process.env.OWNER_ESTANCIA_START_DATE;
 if(!isCivilDate(cutoff))throw new Error('Estância reporting cutover not configured');
 const [dayuse,school]=await Promise.allSettled([
  withOwnerSource('estancia',c=>readDayUseFacts(c,range)),withOwnerSource('estancia_school',c=>readEstanciaFacts(c,range))
 ]);
 const dayMap=new Map(dayuse.status==='fulfilled'?dayuse.value.map(d=>[d.date,d]):[]),schoolMap=new Map(school.status==='fulfilled'?school.value.map(d=>[d.date,d]):[]);
 return ownerDates(range).map(date=>{
  const d=dayMap.get(date),s=schoolMap.get(date);
  const result=unavailableOwnerDay('estancia',date,'Despesas e resultado pendentes de confirmação com o Isaque.');
  if(!d&&!s){result.warnings.push('As fontes day use e escolas estão indisponíveis.');return result;}
  result.state=date<cutoff?'legacy':'open';result.source='Estância · vendas conciliáveis por visita e vouchers lidos; sem fechamento gerencial';
  const schoolDay=!!s?.schoolDay||!!d?.schoolDay;
  const dayRevenue=d?value(d.site)+value(d.gate):0,schoolRevenue=s?value(s.site)+value(s.gate):0;
  result.knownRevenueCents=dayRevenue+schoolRevenue;
  result.dayUseAttendance=d?value(d.admitted):null;result.tripAttendance=schoolDay?null:s?value(s.admitted):null;
  result.knownAttendance=(d?value(d.admitted):0)+(s?value(s.admitted):0);
  result.revenueCents=d&&s&&!schoolDay&&!value(d.unreconciled)&&!value(s.unreconciled)?result.knownRevenueCents:null;
  result.attendance=d&&s&&!schoolDay&&!value(d.unknownAdmissions)&&!value(s.unknownAdmissions)?result.knownAttendance:null;
  result.operating=d&&s?d.scheduled||s.scheduled||result.knownRevenueCents>0||result.knownAttendance>0:null;
  if(date<cutoff){result.revenueCents=null;result.attendance=null;result.warnings.push('Histórico reconstruído anterior à implantação: ainda não conciliado.');}
  result.revenueSources={site:d&&!value(d.unreconciled)?value(d.site):null,gate:d&&!value(d.unreconciled)?value(d.gate):null,trips:schoolDay?null:0,services:null};
  result.warnings.push('Valores provisórios. Adicionais estão incluídos nas vendas de site/caixa; não são somados novamente.');
  if(!d||!s)result.warnings.push(`Fonte ${!d?'day use':'escolar'} indisponível; os números conhecidos são parciais.`);
  if(schoolDay)result.warnings.push('Passeios: apenas compras online disponíveis. Recebimento final e contagem completa ainda sem fonte verificada.');
  if((d&&value(d.unknownAdmissions))||(s&&value(s.unknownAdmissions)))result.warnings.push('Há vouchers usados sem classificação comprovada entre entrada e adicional.');
  if((d&&value(d.unreconciled))||(s&&value(s.unreconciled)))result.warnings.push('Compras com valores de itens diferentes do total aguardam conciliação e não entram no subtotal.');
  return result;
 });
}
