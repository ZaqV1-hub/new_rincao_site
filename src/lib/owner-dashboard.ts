import {getSaoPauloToday,isCivilDate} from './operational-date';
export type OwnerPark='rincao'|'estancia';
export type OwnerMode='day'|'month'|'year';
export type OwnerRange={start:string;end:string};
export type OwnerDay={
 park:OwnerPark;date:string;asOf:string;state:'closed'|'open'|'legacy'|'unavailable';revision:number|null;
 revenueCents:number|null;knownRevenueCents:number;costCents:number|null;resultCents:number|null;
 attendance:number|null;knownAttendance:number;dayUseAttendance:number|null;tripAttendance:number|null;
 revenueSources:{site:number|null;gate:number|null;trips:number|null;services:number|null};
 operating:boolean|null;warnings:string[];source:string;
};
export type OwnerPeriod=ReturnType<typeof ownerPeriod>;
export const OWNER_PARKS={rincao:{name:'Rincão',color:'#2563eb'},estancia:{name:'Estância',color:'#16805d'}} as const;
export function shiftOwnerDay(date:string,days:number){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
function endMonth(year:number,month:number){return new Date(Date.UTC(year,month,0,12)).toISOString().slice(0,10);}
function monthStart(year:number,month:number){return new Date(Date.UTC(year,month-1,1,12)).toISOString().slice(0,10);}
export function ownerPeriod(mode:string,date:string,today=getSaoPauloToday()){
 if(!['day','month','year'].includes(mode)||!isCivilDate(date)||!isCivilDate(today)||date<'2000-01-01'||date>'2100-12-31'||date>today)throw new Error('Período inválido.');
 const [y,m,d]=date.split('-').map(Number);let current:OwnerRange,previous:OwnerRange,nextDate:string,previousDate:string;
 if(mode==='day'){current={start:date,end:date};previousDate=shiftOwnerDay(date,-1);previous={start:previousDate,end:previousDate};nextDate=shiftOwnerDay(date,1);}
 else if(mode==='month'){
  const partial=date.slice(0,7)===today.slice(0,7);const prevStart=monthStart(y,m-1);const [py,pm]=prevStart.split('-').map(Number);
  current={start:monthStart(y,m),end:partial?today:endMonth(y,m)};
  previous={start:prevStart,end:partial?`${prevStart.slice(0,8)}${String(Math.min(Number(today.slice(8)),Number(endMonth(py,pm).slice(8)))).padStart(2,'0')}`:endMonth(py,pm)};
  previousDate=prevStart;nextDate=monthStart(y,m+1);
 }else{
  const partial=date.slice(0,4)===today.slice(0,4);const [,tm,td]=today.split('-').map(Number);
  current={start:`${y}-01-01`,end:partial?today:`${y}-12-31`};
  previous={start:`${y-1}-01-01`,end:partial?`${y-1}-${String(tm).padStart(2,'0')}-${String(Math.min(td,Number(endMonth(y-1,tm).slice(8)))).padStart(2,'0')}`:`${y-1}-12-31`};
  previousDate=`${y-1}-01-01`;nextDate=`${y+1}-01-01`;
 }
 void d;
 return {mode:mode as OwnerMode,date,current,previous,chart:mode==='day'?{start:shiftOwnerDay(date,-6),end:date}:current,
  previousDate:previousDate<'2000-01-01'?null:previousDate,next:nextDate>today?null:nextDate,today};
}
export function ownerDates(range:OwnerRange){const dates:string[]=[];for(let d=range.start;d<=range.end;d=shiftOwnerDay(d,1)){dates.push(d);if(dates.length>740)throw new Error('Intervalo excedido.');}return dates;}
export function ownerTotals(days:OwnerDay[]){
 const total=(key:'revenueCents'|'costCents'|'attendance')=>days.length&&days.every(d=>d[key]!==null)?days.reduce((n,d)=>n+d[key]!,0):null;
 const revenueCents=total('revenueCents'),costCents=total('costCents');
 return {revenueCents,costCents,resultCents:revenueCents!==null&&costCents!==null?revenueCents-costCents:null,attendance:total('attendance'),
  knownRevenueCents:days.reduce((n,d)=>n+d.knownRevenueCents,0),knownAttendance:days.reduce((n,d)=>n+(d.knownAttendance??0),0),
  costPercent:revenueCents!==null&&revenueCents>0&&costCents!==null?costCents/revenueCents*100:null,
  closedDays:days.filter(d=>d.state==='closed').length,operatingDays:days.every(d=>d.operating!==null)?days.filter(d=>d.operating).length:null,
  missingDays:days.filter(d=>d.state==='legacy'||d.state==='unavailable').length};
}
export function ownerChange(current:number|null,previous:number|null){return current===null||previous===null||previous===0?null:(current-previous)/Math.abs(previous)*100;}
export function unavailableOwnerDay(park:OwnerPark,date:string,reason:string,state:OwnerDay['state']='unavailable'):OwnerDay{
 return {park,date,asOf:new Date().toISOString(),state,revision:null,revenueCents:null,knownRevenueCents:0,costCents:null,resultCents:null,attendance:null,knownAttendance:0,dayUseAttendance:null,tripAttendance:null,revenueSources:{site:null,gate:null,trips:null,services:null},operating:null,warnings:[reason],source:'unavailable'};
}
export type OwnerDashboard={period:OwnerPeriod;parks:OwnerPark[];days:OwnerDay[];generatedAt:string};
