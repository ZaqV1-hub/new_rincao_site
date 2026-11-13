import {Pool,type PoolClient} from 'pg';
import {DAY_SALES_SQL,DAY_COUNTS_SQL,DAY_FINANCIAL_SQL} from './operational-day-summary-sql';
import {ownerDates,unavailableOwnerDay,type OwnerDashboard,type OwnerDay,type OwnerPark,type OwnerPeriod,type OwnerRange} from './owner-dashboard';
import type {OperationalDaySummary} from './operational-day-summary';
import {isCivilDate} from './operational-date';
import {readEstanciaOwnerDays} from './owner-estancia-source';
type Client=Pick<PoolClient,'query'>;
export type OwnerSource='rincao'|'estancia'|'estancia_school';
const pools=new Map<OwnerSource,Pool>();
const envKeys={rincao:'OWNER_RINCAO_READ_DATABASE_URL',estancia:'OWNER_ESTANCIA_READ_DATABASE_URL',estancia_school:'OWNER_ESTANCIA_SCHOOL_READ_DATABASE_URL'} as const;
function pool(source:OwnerSource){
 const url=process.env[envKeys[source]];if(!url)throw new Error('Owner source not configured');
 let p=pools.get(source);if(!p){p=new Pool({connectionString:url,max:2,connectionTimeoutMillis:5000,idleTimeoutMillis:30000,query_timeout:20000,application_name:`owners-${source}`,options:'-c default_transaction_read_only=on -c statement_timeout=18000 -c search_path=public -c jit=off'});pools.set(source,p);}return p;
}
export async function withOwnerSource<T>(source:OwnerSource,read:(client:Client)=>Promise<T>){
 const expected=process.env[`OWNER_${source.toUpperCase()}_EXPECTED_DATABASE`];if(!expected)throw new Error('Expected owner source identity not configured');
 const c=await pool(source).connect();let discard=false;
 try{
  await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const permission=(await c.query<{unsafe:boolean;database:string}>(`SELECT current_database() AS database, (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls OR has_schema_privilege(current_user,'public','CREATE') OR EXISTS (
    SELECT 1 FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relkind IN ('r','p','v','m','f') AND (
     has_table_privilege(current_user,t.oid,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER') OR has_any_column_privilege(current_user,t.oid,'INSERT,UPDATE')))) AS unsafe FROM pg_roles r WHERE r.rolname=current_user`)).rows[0];
  if(!permission||permission.unsafe||permission.database!==expected)throw new Error('Owner source must use a restricted read-only role');
  const result=await read(c);await c.query('COMMIT');return result;
 }catch(e){try{await c.query('ROLLBACK');}catch{discard=true;}throw e;}finally{c.release(discard);}
}
function integer(value:unknown):number {const n=Number(value);if(value===null||value===undefined||!Number.isSafeInteger(n)||n<0)throw new Error('Invalid owner aggregate');return n;}
function metric(value:{status:string;value:number|null}|undefined){return value?.status==='available'?integer(value.value):null;}
export function ownerDayFromSummary(summary:OperationalDaySummary,revision:number,asOf:string):OwnerDay{
 const revenueCents=metric(summary.revenue.totalCents),costCents=metric(summary.expenses),attendance=metric(summary.attendance.totalAdmitted);
 return {park:'rincao',date:summary.date,asOf,state:'closed',revision,revenueCents,costCents,resultCents:revenueCents!==null&&costCents!==null?revenueCents-costCents:null,
  knownRevenueCents:integer(summary.revenue.knownSubtotalCents),attendance,knownAttendance:integer(summary.attendance.dayUseAdmitted.value)+integer(summary.attendance.completedVehiclePeople.value),
  dayUseAttendance:metric(summary.attendance.dayUseAdmitted),tripAttendance:metric(summary.attendance.completedVehiclePeople),
  revenueSources:{site:metric(summary.revenue.siteNetCents),gate:metric(summary.revenue.gateNetCents),services:metric(summary.revenue.servicesNetCents),trips:metric(summary.revenue.finalizedTripsNetCents)},
  operating:!!summary.configuration?.dayUseOpen||summary.groupCount>0||integer(summary.cash.value)>0||!!revenueCents||!!attendance,
  warnings:summary.warnings.map(w=>w.message),source:`Fechamento diário Rincão · revisão ${revision}`};
}
function daySql(sql:string){return sql.replaceAll('$1','dates.day').replaceAll('$2',"'rincao'");}
export const OWNER_RINCAO_SQL=`WITH dates AS (SELECT d::date AS day FROM generate_series($1::date,$2::date,interval '1 day') d)
 SELECT dates.day::text AS date,f.revisao AS revision,f.created_at AS "closedAt",f.snapshot->'summary' AS frozen,(d.data IS NOT NULL AND f.id IS NULL) AS "closedWithoutSnapshot",
  CASE WHEN f.id IS NULL AND dates.day >= $3::date THEN (SELECT row_to_json(s) FROM (${daySql(DAY_SALES_SQL)}) s) END AS sales,
  CASE WHEN f.id IS NULL AND dates.day >= $3::date THEN (SELECT row_to_json(m) FROM (${daySql(DAY_COUNTS_SQL)}) m) END AS metadata,
  CASE WHEN f.id IS NULL AND dates.day >= $3::date THEN (SELECT row_to_json(x) FROM (${daySql(DAY_FINANCIAL_SQL)}) x) END AS financial,
  EXISTS(SELECT 1 FROM agenda a WHERE a.dtagenda=dates.day AND a.stagenda IN ('abe','lot')) AS scheduled
 FROM dates LEFT JOIN operacao_dias d ON d.parque='rincao' AND d.data=dates.day AND d.estado='closed'
 LEFT JOIN operacao_fechamentos f ON f.id=d.fechamento_id AND f.parque=d.parque AND f.data=d.data ORDER BY dates.day`;
type RawDay={date:string;revision:number|null;closedAt:Date;frozen:OperationalDaySummary|null;sales:Record<string,string>|null;metadata:Record<string,string>|null;financial:Record<string,string>|null;scheduled:boolean;closedWithoutSnapshot:boolean};
export async function readRincaoOwnerDays(client:Client,range:OwnerRange,cutoff:string):Promise<OwnerDay[]>{
 if(!isCivilDate(cutoff))throw new Error('Configure o início da apuração do Rincão.');
 const rows=(await client.query<RawDay>(OWNER_RINCAO_SQL,[range.start,range.end,cutoff])).rows;
 return rows.map(row=>{
  if(row.frozen&&row.revision){if(row.frozen.date!==row.date||row.frozen.park!=='rincao')throw new Error('Snapshot source mismatch');return ownerDayFromSummary(row.frozen,row.revision,row.closedAt.toISOString());}
  if(row.closedWithoutSnapshot)return unavailableOwnerDay('rincao',row.date,'Data encerrada sem revisão gerencial disponível.');
  if(row.date<cutoff)return unavailableOwnerDay('rincao',row.date,'Histórico anterior à implantação: ainda não conciliado.','legacy');
  const s=row.sales!,m=row.metadata!,f=row.financial!;
  if(integer(s.invalidAmounts)||integer(f.invalidReceipts))return unavailableOwnerDay('rincao',row.date,'Há valores que precisam de conferência na origem.');
  const revenueSources={site:integer(s.site),gate:integer(s.gate),services:integer(s.services),trips:integer(f.revenue)};
  const knownRevenueCents=Object.values(revenueSources).reduce((n,v)=>n+v,0),costCents=integer(f.expenses),knownAttendance=integer(s.admitted)+integer(m.countedPeople);
  const revenueCents=integer(s.unclassifiedCount)?null:knownRevenueCents,attendance=integer(m.incompleteGroups)?null:knownAttendance;
  const warnings=['Dia aberto: valores provisórios.'];
  if(revenueCents===null)warnings.push('Há vendas sem classificação comprovada.');
  if(attendance===null)warnings.push('Há grupos sem contagem concluída.');
  if(integer(f.unfinished))warnings.push('Passeios ainda não finalizados ficam fora da receita.');
  if(integer(s.legacyDates))warnings.push('Vouchers legados usam a data atual da agenda.');
  if(integer(s.invalidatedPaid))warnings.push('Há vouchers invalidados de compras confirmadas; confira os ajustes financeiros.');
  return {park:'rincao',date:row.date,asOf:m.generatedAt,state:'open',revision:null,revenueCents,knownRevenueCents,costCents,resultCents:revenueCents===null?null:revenueCents-costCents,
   attendance,knownAttendance,dayUseAttendance:integer(s.admitted),tripAttendance:integer(m.countedPeople),revenueSources,
   operating:row.scheduled||integer(m.groupCount)>0||integer(m.cashCount)>0||knownRevenueCents>0||knownAttendance>0,warnings,source:'Apuração operacional Rincão · data da visita / entrada efetiva'};
 });
}
export async function getOwnerDashboard(period:OwnerPeriod,parks:OwnerPark[]):Promise<OwnerDashboard>{
 const range={start:[period.current.start,period.previous.start,period.chart.start].sort()[0],end:period.current.end};
 const results=await Promise.all(parks.map(async park=>{
  try{return park==='rincao'?await withOwnerSource('rincao',c=>readRincaoOwnerDays(c,range,process.env.OWNER_RINCAO_START_DATE??'')):await readEstanciaOwnerDays(range);}
  catch{console.warn(`[owners] ${park} read unavailable`);return ownerDates(range).map(date=>unavailableOwnerDay(park,date,'Fonte indisponível ou ainda não configurada para consulta.'));}
 }));
 return {period,parks,days:results.flat(),generatedAt:new Date().toISOString()};
}
