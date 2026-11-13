import React from 'react';
import path from 'node:path';
import { Document,Font,Page,Text,View,Svg,Rect,Image as PdfImage,renderToBuffer } from '@react-pdf/renderer';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import type { OperationalDayRevision,OperationalDaySnapshot } from './operational-day-closure';
import { COUNT_CATEGORIES,countCategories } from './trip-counting-contract';
import { TRIP_PAYMENT_METHODS } from './trip-settlement-contract';
export type DailyExportSection={title:string;headers:string[];rows:(string|number|null)[][];moneyColumns:number[]};
const method=(key:string)=>TRIP_PAYMENT_METHODS[key as keyof typeof TRIP_PAYMENT_METHODS]??key;
const reais=(cents:number|null)=>cents===null?null:cents/100;
const currency=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
export function dailyExportSections(s:OperationalDaySnapshot,periodId?:number):DailyExportSection[]{
  const sessions=periodId?s.sessions.filter(c=>c.id===periodId):s.sessions;
  if(periodId&&!sessions.length)throw new Error('Caixa não pertence a esta revisão.');
  const sections:DailyExportSection[]=[];
  if(!periodId)sections.push({title:'Indicadores',headers:['Indicador','Valor'],moneyColumns:[],rows:[['Receita da visita (R$)',reais(s.revenueCents)],['Despesas (R$)',reais(s.expenseCents)],['Resultado (R$)',reais(s.resultCents)],['Day use admitido',s.summary.attendance.dayUseAdmitted.value],['Pessoas em veículos concluídos',s.summary.attendance.completedVehiclePeople.value],['Público total',s.summary.attendance.totalAdmitted.value],['Reembolsos pendentes (R$)',reais(s.refundsPendingCents)],['Dinheiro nos caixas (R$)',reais(s.sessions.reduce((sum,c)=>sum+c.snapshot.expectedCashCents,0))],['Lançamentos de despesas',s.expenses?.length??null]]},
    {title:'Receita por origem',headers:['Origem','Valor (R$)'],moneyColumns:[1],rows:[['Site',reais(s.summary.revenue.siteNetCents.value)],['Bilheteria',reais(s.summary.revenue.gateNetCents.value)],['Serviços',reais(s.summary.revenue.servicesNetCents.value)],['Passeios finalizados',reais(s.summary.revenue.finalizedTripsNetCents.value)],['Não classificados (fora do subtotal)',reais(s.summary.revenue.unclassifiedNetCents.value)]]});
  sections.push({title:'Caixas',headers:['Caixa','Local','Tipo','Situação','Esperado (R$)','Contado (R$)','Diferença (R$)'],moneyColumns:[4,5,6],rows:sessions.map(c=>[c.id,c.locationName,c.type==='trips'?'Passeios':'Vendas',c.closedAt?'Fechado':'Aberto',reais(c.snapshot.expectedCashCents),reais(c.snapshot.countedCashCents),reais(c.snapshot.differenceCents)])},
    {title:'Dinheiro dos caixas',headers:['Caixa','Troco inicial (R$)','Fundos (R$)','Recebido em dinheiro (R$)','Sangrias (R$)','Despesas (R$)','Devoluções (R$)'],moneyColumns:[1,2,3,4,5,6],rows:sessions.map(c=>[c.id,reais(c.snapshot.openingCashCents),reais(c.snapshot.fundsCents),reais(c.snapshot.cashReceivedCents),reais(c.snapshot.withdrawalsCents),reais(c.snapshot.expensesCents),reais(c.snapshot.refundsCents)])},
    {title:'Modalidades por caixa',headers:['Caixa','Modalidade','Valor (R$)'],moneyColumns:[2],rows:sessions.flatMap(c=>c.snapshot.payments.map(p=>[c.id,method(p.method),reais(p.amountCents)]))},
    {title:'Movimentos dos caixas',headers:['Caixa','Movimento','Tipo','Responsável','Valor (R$)','Motivo'],moneyColumns:[4],rows:sessions.flatMap(c=>c.snapshot.movements.map(m=>[c.id,m.id,m.type,m.responsible,reais(m.amountCents),m.reason]))},
    {title:'Serviços por caixa',headers:['Caixa','Serviço','Quantidade','Receita (R$)'],moneyColumns:[3],rows:sessions.flatMap(c=>c.snapshot.services.map(service=>[c.id,service.name,service.quantity,reais(service.revenueCents)]))});
  if(!periodId)sections.push(
    {title:'Recebimentos na data',headers:['Origem','Forma','Valor bruto recebido (R$)'],moneyColumns:[2],rows:s.receipts.map(p=>[p.source==='online'?'Site':p.source==='trips'?'Passeios':'Caixas',method(p.method),reais(p.amountCents)])},
    {title:'Passeios',headers:['Agenda','Cliente','Nome','Recibo','Receita finalizada (R$)','A receber (R$)','Boleto pendente (R$)'],moneyColumns:[4,5,6],rows:s.trips.map(t=>[t.agendaId,t.clientId,t.name,t.receiptNumber,t.receiptId?reais(t.calculation?.totalTripCents??null):null,reais(t.remainingCents),reais(t.pendingPaymentCents)])},
    {title:'Contagens',headers:['Passeio','Veículo','Situação',...countCategories.map(k=>COUNT_CATEGORIES[k].label),'Responsável'],moneyColumns:[],rows:s.trips.flatMap(t=>t.vehicles.map(v=>[t.name,v.id,({waiting:'Aguardando',counting:'Em contagem',completed:'Concluído'} as Record<string,string>)[v.state]??'A conferir',...countCategories.map(k=>v.counts?.[k]??null),v.responsible]))},
    {title:'Cortesias e site dos passeios',headers:['Passeio','Adultos cobrados','Crianças cobradas','Categorias não cobradas','Site presente (R$)','Cobrança da escola (R$)'],moneyColumns:[4,5],rows:s.trips.map(t=>[t.name,t.calculation?.adultToCharge??null,t.calculation?.childToCharge??null,t.calculation?.notChargedCount??null,reais(t.calculation?.onlinePresentCents??null),reais(t.calculation?.schoolChargeCents??null)])},
    {title:'Reembolsos dos passeios',headers:['Passeio','Voucher','Previsto (R$)','Pago (R$)','Comprovado em'],moneyColumns:[2,3],rows:s.trips.flatMap(t=>t.refunds.map(r=>[t.name,r.voucherId,reais(r.amountCents),reais(r.paidCents),r.paidAt]))},
    {title:'Valores das compras',headers:['Compra','Total original (R$)','Desconto (R$)'],moneyColumns:[1,2],rows:(s.purchases??[]).map(p=>[p.id,reais(p.totalCents),reais(p.discountCents)])},
    {title:'Compras e day use',headers:['Compra','Voucher','Status da compra','Canal','Categoria','Descrição','Visita escolhida','Usado em','Uso','Pago líquido (R$)','Grupo'],moneyColumns:[9],rows:s.items.map(i=>[i.purchaseId,i.voucherId,({conc:'Concluída',pend:'Pendente',canc:'Cancelada'} as Record<string,string>)[i.status]??'A conferir',({ponli:'Site',bilhe:'Bilheteria',reser:'Reserva'} as Record<string,string>)[i.channel]??'Não classificado',({norma:'Adulto',infan:'Criança',isent:'Isento',corte:'Cortesia',escol:'Escolar',espec:'Adicional'} as Record<string,string>)[i.type]??'Não classificado',i.service,i.visitDate,i.usedOn,({n:'Não usado',s:'Usado',inv:'Invalidado'} as Record<string,string>)[i.used]??'A conferir',reais(i.amountCents),i.schoolId])},
    {title:'Despesas',headers:['Identificação','Escopo','Descrição','Categoria','Valor (R$)','Forma','Referência'],moneyColumns:[4],rows:s.expenses===null?[[null,'Estância','Pendente de confirmação com o Isaque',null,null,null,null]]:s.expenses.map(e=>[e.id,e.scope==='trips'?'Passeios':'Dia',e.description,e.category,reais(e.amountCents),method(e.method),e.reference])},
    {title:'Pendências',headers:['Descrição'],moneyColumns:[],rows:s.warnings.map(w=>[w.message])},
    {title:'Ajustes de compra pendentes',headers:['Ajuste','Compra','Datas afetadas','Solicitado em'],moneyColumns:[],rows:s.adjustments.filter(a=>a.status==='pending').map(a=>[a.id,a.purchaseId,a.sourceDates.join(', '),a.createdAt])});
  sections.push({title:'Conferência posterior de caixa',headers:['Caixa','Contado originalmente (R$)','Contado nesta revisão (R$)','Motivo'],moneyColumns:[1,2],rows:(s.cashReviews??[]).filter(r=>!periodId||r.periodId===periodId).map(r=>[r.periodId,reais(r.originalCountedCents),reais(r.countedCents),r.reason])});
  sections.push({title:'Conferência',headers:['Responsável','Assinatura'],moneyColumns:[],rows:[['Gerente','________________________________'],['Financeiro','________________________________']]});
  return sections;
}
export function safeSpreadsheetText(value:string){return /^[\s\u0000-\u001f]*[=+\-@]/.test(value)?`'${value}`:value;}
export function dailyExportTitle(s:OperationalDaySnapshot,revision:OperationalDayRevision|null,periodId?:number){return `${s.park==='rincao'?'Rincão':'Estância'} · ${s.date.split('-').reverse().join('/')} · ${revision?`Revisão ${revision.revision}`:'Provisório'}${periodId?` · Caixa ${periodId}`:''}`;}
function dailyCharts(s:OperationalDaySnapshot){return [{title:'De onde vem o dinheiro',rows:dailyExportSections(s).find(section=>section.title==='Receita por origem')!.rows.map(row=>[String(row[0]),row[1] as number|null] as const)},{title:'Formas de pagamento (recebimentos registrados)',rows:Object.entries(s.receipts.reduce((result,p)=>({...result,[method(p.method)]:(result[method(p.method)]??0)+p.amountCents/100}),{} as Record<string,number>))}];}
function xml(value:string){return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));}
export async function renderOperationalDayXlsx(s:OperationalDaySnapshot,revision:OperationalDayRevision|null,periodId?:number,generatedBy='Operador autenticado'){
  const book=new ExcelJS.Workbook();book.creator=generatedBy;book.created=new Date(revision?.createdAt??s.generatedAt);
  for(const section of dailyExportSections(s,periodId)){
    const sheet=book.addWorksheet(section.title.slice(0,31));sheet.addRow([dailyExportTitle(s,revision,periodId)]);sheet.addRow([`Apuração: ${s.generatedAt} · Gerado por ${generatedBy} · Ausente = não apurado. Recebimentos e receita possuem bases distintas.`]);sheet.addRow(section.headers);
    sheet.getRow(3).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(3).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF205A7F'}};
    for(const values of section.rows){const row=sheet.addRow(values.map(v=>typeof v==='string'?safeSpreadsheetText(v):v));for(const column of section.moneyColumns)row.getCell(column+1).numFmt='#,##0.00;[Red]-#,##0.00';if(section.title==='Indicadores'&&String(values[0]).includes('(R$)'))row.getCell(2).numFmt='#,##0.00;[Red]-#,##0.00';row.alignment={vertical:'top',wrapText:true};}
    sheet.columns.forEach((column,i)=>{column.width=i===0?25:section.moneyColumns.includes(i)?20:32;});sheet.views=[{state:'frozen',ySplit:3}];sheet.autoFilter={from:{row:3,column:1},to:{row:3,column:section.headers.length}};sheet.pageSetup={paperSize:9,orientation:section.headers.length>5?'landscape':'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0};
  }
  if(!periodId){const sheet=book.addWorksheet('Gráficos');sheet.addRow([dailyExportTitle(s,revision)]);let offset=2;
    for(const chart of dailyCharts(s)){const maximum=Math.max(1,...chart.rows.map(row=>row[1]??0)),height=55+chart.rows.length*55;
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${height}"><rect width="800" height="${height}" fill="white"/><g font-family="sans-serif" fill="#173f68"><text x="15" y="25" font-size="18">${xml(chart.title)}</text>${chart.rows.map(([label,value],i)=>`<text x="15" y="${55+i*55}" font-size="14">${xml(label)}: ${xml(value===null?'Não apurado':currency(value))}</text><rect x="15" y="${65+i*55}" width="${Math.max(0,(value??0)/maximum*750)}" height="10" fill="#205a7f"/>`).join('')}</g></svg>`;
      const png=await sharp(Buffer.from(svg)).png().toBuffer(),imageId=book.addImage({base64:png.toString('base64'),extension:'png'});sheet.addImage(imageId,{tl:{col:0,row:offset},ext:{width:800,height}});offset+=Math.ceil(height/20)+2;
    }
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}
Font.register({family:'Daily Report Rubik',fonts:[{src:path.join(process.cwd(),'public/fonts/rubik-400.ttf')},{src:path.join(process.cwd(),'public/fonts/rubik-700.ttf'),fontWeight:700}]});
export async function renderOperationalDayPdf(s:OperationalDaySnapshot,revision:OperationalDayRevision|null,periodId?:number,generatedBy='Operador autenticado'){
  const sections=dailyExportSections(s,periodId),charts=periodId?[]:dailyCharts(s);
  return renderToBuffer(<Document title={dailyExportTitle(s,revision,periodId)} language="pt-BR"><Page size="A4" style={{padding:30,paddingBottom:45,fontFamily:'Daily Report Rubik',fontSize:8,color:'#173f68'}}>
    <PdfImage src={path.join(process.cwd(),s.park==='rincao'?'public/brand/rincao-logo.png':'public/brand/estancia-logo-dark.png')} style={{width:100,height:45,objectFit:'contain',marginBottom:8}}/>
    <Text style={{fontSize:16,fontWeight:700,marginBottom:8}}>{dailyExportTitle(s,revision,periodId)}</Text><Text style={{marginBottom:10}}>Apuração: {s.generatedAt}. Gerado por {generatedBy}. Valores ausentes permanecem não apurados. Receita corresponde à visita; recebimentos correspondem ao registro financeiro. Estornos e devoluções estão separados.</Text>
    {revision&&<Text style={{marginBottom:10}}>Fechado por {revision.actorName??'Gerente identificado'}. Motivo: {revision.reason||'Sem exceção registrada'}.</Text>}
    {charts.map(chart=>{const maximum=Math.max(1,...chart.rows.map(row=>typeof row[1]==='number'?row[1]:0));return <View key={chart.title} wrap={false} style={{marginBottom:12}}><Text style={{fontWeight:700,marginBottom:6}}>{chart.title} (R$)</Text>{chart.rows.map((row,i)=><View key={i} style={{marginBottom:5}}><Text>{row[0]}: {row[1]===null?'Não apurado':currency(row[1] as number)}</Text><Svg width={490} height={7}><Rect x={0} y={0} width={Math.max(0,Number(row[1]??0)/maximum*490)} height={7} fill={i%2?'#397f69':'#205a7f'}/></Svg></View>)}</View>;})}
    {sections.map(section=><View key={section.title} style={{marginBottom:12}}><Text style={{fontSize:11,fontWeight:700,marginTop:5,marginBottom:6}} minPresenceAhead={30}>{section.title}</Text>{!section.rows.length?<Text>Nenhum registro.</Text>:section.rows.map((row,i)=><View key={i} wrap={false} style={{paddingVertical:5,borderBottom:'0.5 solid #ccd8e2'}}><Text hyphenationCallback={word=>word.length>40?Array.from(word):[word]}>{row.map((value,j)=>`${section.headers[j]}: ${value===null?'Não apurado':(section.moneyColumns.includes(j)||(section.title==='Indicadores'&&j===1&&String(row[0]).includes('(R$)')))?currency(value as number):value}`).join(' · ')}</Text></View>)}</View>)}
    <Text fixed style={{position:'absolute',bottom:20,left:30,right:30,fontSize:7}} render={({pageNumber,totalPages})=>`${dailyExportTitle(s,revision,periodId)} · ${pageNumber}/${totalPages}`}/>
  </Page></Document>);
}
