'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
import {OWNER_PARKS,ownerDates,ownerTotals,ownerChange,type OwnerDashboard,type OwnerDay,type OwnerPark,type OwnerRange} from '@/lib/owner-dashboard';
import styles from './owner-dashboard.module.css';
const money=(n:number|null)=>n===null?'Indisponível':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
const number=(n:number|null)=>n===null?'Indisponível':n.toLocaleString('pt-BR');
const dateLabel=(date:string)=>date.split('-').reverse().join('/');
const stateLabel={closed:'Fechado',open:'Aberto · provisório',legacy:'Legado não conciliado',unavailable:'Fonte indisponível'};
function inRange(day:OwnerDay,range:OwnerRange){return day.date>=range.start&&day.date<=range.end;}
function change(current:number|null,previous:number|null){const delta=ownerChange(current,previous);return delta===null?'Sem base para comparação':`${delta>0?'+':''}${delta.toLocaleString('pt-BR',{maximumFractionDigits:1})}% em relação ao período anterior`;}
export function OwnerDashboardPage({data,name,allowedParks,error}:{data:OwnerDashboard;name:string;allowedParks:OwnerPark[];error:string}){
 const router=useRouter();const [busy,setBusy]=useState(false),[feedback,setFeedback]=useState(''),[chartSelection,setChartSelection]=useState('');
 const {period,parks}=data;const selectedPark=parks.length>1?'both':parks[0];
 const href=(date:string,mode=period.mode)=>`/donos?${new URLSearchParams({date,mode,park:selectedPark})}`;
 const current=data.days.filter(d=>inRange(d,period.current));
 const groups=period.mode==='year'?Array.from({length:Number(period.current.end.slice(5,7))},(_,i)=>({key:`${period.current.start.slice(0,4)}-${String(i+1).padStart(2,'0')}`,label:new Intl.DateTimeFormat('pt-BR',{month:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2026,i,1)))})):
  ownerDates(period.chart).map(date=>({key:date,label:date.slice(8)}));
 const groupDays=(key:string,park:OwnerPark)=>data.days.filter(d=>d.park===park&&d.date.startsWith(key)&&inRange(d,period.chart));
 const warnings=[...new Set(current.flatMap(d=>d.warnings))];
 const exportQuery=new URLSearchParams({mode:'month',date:period.date,park:selectedPark});
 return <main className={styles.shell}>
  <header className={styles.header}><div><p className={styles.eyebrow}>Rincão + Estância · somente leitura</p><h1>Painel dos donos</h1><p>Olá, {name}. Acompanhe a operação dos parques.</p></div><button disabled={busy} onClick={async()=>{setBusy(true);try{const r=await fetch('/api/donos/session',{method:'DELETE'});if(!r.ok)throw new Error();router.refresh();}catch{setFeedback('Não foi possível sair. Tente novamente.');}finally{setBusy(false);}}}>Sair</button></header>
  {(error||feedback)&&<p role="alert" className={styles.notice}>{error||feedback}</p>}
  <form className={styles.filters} action="/donos"><fieldset><legend>Período</legend><select name="mode" aria-label="Tipo de período" defaultValue={period.mode}><option value="day">Dia</option><option value="month">Mês</option><option value="year">Ano</option></select></fieldset>
   <label>Data de referência<input name="date" type="date" defaultValue={period.date} min="2000-01-01" max={period.today} required/></label>
   <label>Parque<select name="park" defaultValue={selectedPark}>{allowedParks.length>1&&<option value="both">Os dois parques</option>}{allowedParks.map(p=><option key={p} value={p}>{OWNER_PARKS[p].name}</option>)}</select></label><button>Consultar</button>
  </form>
  <nav className={styles.periodNav} aria-label="Navegação de período">{period.previousDate?<Link href={href(period.previousDate)} prefetch={false} aria-label="Período anterior">← Anterior</Link>:<span/>}<div><h2>{period.mode==='day'?dateLabel(period.date):period.mode==='year'?period.date.slice(0,4):new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${period.date}T12:00:00Z`))}</h2><p>Comparação: {dateLabel(period.previous.start)}{period.previous.end!==period.previous.start&&` a ${dateLabel(period.previous.end)}`}</p></div>{period.next?<Link href={href(period.next)} prefetch={false} aria-label="Próximo período">Próximo →</Link>:<span className={styles.disabled}>Próximo →</span>}</nav>
  <div className={styles.parks}>{parks.map(park=>{
   const days=current.filter(d=>d.park===park),totals=ownerTotals(days),previous=ownerTotals(data.days.filter(d=>d.park===park&&inRange(d,period.previous)));
   return <section key={park} className={styles.park} style={{borderTopColor:OWNER_PARKS[park].color}}>
    <div className={styles.parkHeading}><h2 style={{color:OWNER_PARKS[park].color}}>{OWNER_PARKS[park].name}</h2><span>{period.mode==='day'?stateLabel[days[0]?.state??'unavailable']:`${totals.closedDays} de ${days.length} dias com fechamento`}</span></div>
    <dl className={styles.metrics}>{([{key:'attendance',label:'Público',format:number},{key:'revenueCents',label:'Receita',format:money},{key:'costCents',label:'Custos',format:money},{key:'resultCents',label:'Resultado',format:money}] as const).map(metric=><div key={metric.key}><dt>{metric.label}</dt><dd>{metric.format(totals[metric.key])}</dd><small>{change(totals[metric.key],previous[metric.key])}</small>{metric.key==='costCents'&&totals.costPercent!==null&&<small>{totals.costPercent.toLocaleString('pt-BR',{maximumFractionDigits:1})}% da receita</small>}</div>)}</dl>
    {(totals.revenueCents===null||totals.attendance===null)&&days.some(d=>d.source!=='unavailable')&&<p className={styles.notice}>Subtotal dos registros disponíveis: {money(totals.knownRevenueCents)} e {number(totals.knownAttendance)} entradas. Não representa o total do período.</p>}
    {park==='estancia'&&<p className={styles.caption}>Despesas e resultado aguardam confirmação com o Isaque.</p>}
    {period.mode==='day'&&days[0]&&<details><summary>Origem dos números</summary><dl className={styles.sources}>
     <div><dt>Ingressos no site</dt><dd>{money(days[0].revenueSources.site)}</dd></div><div><dt>Ingressos nos caixas</dt><dd>{money(days[0].revenueSources.gate)}</dd></div><div><dt>Passeios</dt><dd>{money(days[0].revenueSources.trips)}</dd></div><div><dt>Serviços adicionais</dt><dd>{money(days[0].revenueSources.services)}</dd></div><div><dt>Entradas de day use</dt><dd>{number(days[0].dayUseAttendance)}</dd></div><div><dt>Pessoas nos passeios</dt><dd>{number(days[0].tripAttendance)}</dd></div>
    </dl><p className={styles.caption}>{days[0].source==='unavailable'?'Fonte indisponível':days[0].source}</p></details>}
   </section>;
  })}</div>
  <section className={styles.panel}><h2>{period.mode==='day'?'Público dos últimos 7 dias':period.mode==='year'?'Evolução mês a mês':'Evolução dia a dia'}</h2><p className={styles.legend}>{parks.map(park=><span key={park}><i style={{background:OWNER_PARKS[park].color}}/>{OWNER_PARKS[park].name}</span>)}<span>∅ indica informação incompleta</span></p>
   {(period.mode==='day'?['attendance']:['attendance','revenueCents'] as const).map(metric=>{
    const values=groups.map(g=>({g,items:parks.map(park=>({park,value:ownerTotals(groupDays(g.key,park))[metric as 'attendance'|'revenueCents']}))}));
    const max=Math.max(1,...values.map(v=>v.items.reduce((sum,i)=>sum+(i.value??0),0)));
    return <div key={metric}><h3>{metric==='attendance'?'Público':'Receita'}</h3><div className={styles.chart} role="group" aria-label={metric==='attendance'?'Público por período':'Receita por período'}>{values.map(({g,items})=>{
     const description=`${g.key}: ${items.map(i=>`${OWNER_PARKS[i.park].name} ${metric==='attendance'?number(i.value):money(i.value)}`).join('; ')}`;
     return <button key={g.key} type="button" className={styles.bar} title={description} aria-label={description} onClick={()=>setChartSelection(description)}><span className={styles.stack}>{items.some(i=>i.value===null)&&<b>∅</b>}{items.map(i=><span key={i.park} style={{background:OWNER_PARKS[i.park].color,height:`${(i.value??0)/max*140}px`}}/>)}</span><span>{g.label}</span></button>;
    })}</div></div>;
   })}<p className={styles.caption} aria-live="polite">{chartSelection||'Selecione uma coluna para consultar os valores.'}</p>
  </section>
  {period.mode!=='day'&&<section className={styles.panel}><div className={styles.parkHeading}><h2>{period.mode==='month'?'Fechamento do mês':'Resumo do ano'}</h2>{period.mode==='month'&&<div className={styles.exports}><a href={`/api/donos/exportar?${exportQuery}&format=pdf`}>Baixar PDF</a><a href={`/api/donos/exportar?${exportQuery}&format=xlsx`}>Baixar planilha</a></div>}</div>
   <p className={styles.caption}>Valores fechados preservam a revisão de origem. Dias abertos são provisórios. Receita segue a data da visita; público, a entrada efetiva.</p>
   <div className={styles.tableWrap}><table><caption>Resumo por parque</caption><thead><tr><th>Parque</th><th>Dias de operação</th><th>Dias fechados</th><th>Público</th><th>Receita</th><th>Custos</th><th>Resultado</th></tr></thead><tbody>{parks.map(park=>{const t=ownerTotals(current.filter(d=>d.park===park));return <tr key={park}><th>{OWNER_PARKS[park].name}</th><td>{number(t.operatingDays)}</td><td>{t.closedDays}</td><td>{number(t.attendance)}</td><td>{money(t.revenueCents)}</td><td>{money(t.costCents)}</td><td>{money(t.resultCents)}</td></tr>;})}</tbody></table></div>
   <div className={styles.tableWrap}><table><caption>{period.mode==='year'?'Mês a mês':'Dia a dia'}</caption><thead><tr><th>Período</th><th>Parque</th><th>Público</th><th>Receita</th><th>Custos</th><th>Resultado</th><th>Fechamento</th></tr></thead><tbody>{groups.flatMap(g=>parks.map(park=>{const days=groupDays(g.key,park),t=ownerTotals(days);return <tr key={`${g.key}-${park}`}><th>{g.key.length===10?dateLabel(g.key):g.label}</th><td>{OWNER_PARKS[park].name}</td><td>{number(t.attendance)}</td><td>{money(t.revenueCents)}</td><td>{money(t.costCents)}</td><td>{money(t.resultCents)}</td><td>{period.mode==='month'?stateLabel[days[0]?.state??'unavailable']:`${t.closedDays}/${days.length} dias`}</td></tr>;}))}</tbody></table></div>
   {period.mode==='month'&&<div className={styles.busiest}>{parks.map(park=><div key={park}><h3>Dias mais cheios · {OWNER_PARKS[park].name}</h3><ol>{current.filter(d=>d.park===park&&d.attendance!==null).sort((a,b)=>b.attendance!-a.attendance!).slice(0,3).map(d=><li key={d.date}>{dateLabel(d.date)} · {number(d.attendance)} pessoas</li>)}</ol>{!current.some(d=>d.park===park&&d.attendance!==null)&&<p>Sem contagem completa disponível.</p>}</div>)}</div>}
  </section>}
  {warnings.length>0&&<details className={styles.panel}><summary>Observações e pendências ({warnings.length})</summary><ul>{warnings.map(w=><li key={w}>{w}</li>)}</ul></details>}
  <footer className={styles.caption}>Consultado em {new Date(data.generatedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} · Horário de Brasília. <button type="button" onClick={()=>router.refresh()}>Atualizar consulta</button></footer>
 </main>;
}
