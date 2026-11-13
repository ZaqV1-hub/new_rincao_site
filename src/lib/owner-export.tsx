import React from 'react';
import path from 'node:path';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import {Document,Page,Text,View,Svg,Rect,Image as PdfImage,renderToBuffer} from '@react-pdf/renderer';
import {safeSpreadsheetText,type DailyExportSection} from './operational-day-export';
import {OWNER_PARKS,ownerTotals,ownerDates,type OwnerDashboard} from './owner-dashboard';
const reais=(value:number|null)=>value===null?null:value/100;
const states={closed:'Fechado',open:'Aberto / provisório',legacy:'Legado não conciliado',unavailable:'Indisponível'};
export function ownerExportSections(data:OwnerDashboard):DailyExportSection[]{
 if(data.period.mode!=='month')throw new Error('Escolha um mês para exportar.');
 const rows=data.days.filter(d=>d.date>=data.period.current.start&&d.date<=data.period.current.end);
 return [{title:'Resumo mensal',headers:['Parque','Dias de operação','Dias fechados','Público','Receita (R$)','Custos (R$)','Resultado (R$)'],moneyColumns:[4,5,6],rows:data.parks.map(p=>{const t=ownerTotals(rows.filter(d=>d.park===p));return [OWNER_PARKS[p].name,t.operatingDays,t.closedDays,t.attendance,reais(t.revenueCents),reais(t.costCents),reais(t.resultCents)];})},
 {title:'Dia a dia',headers:['Data','Parque','Público','Receita (R$)','Custos (R$)','Resultado (R$)','Situação','Revisão','Fonte','Atualizado em'],moneyColumns:[3,4,5],rows:rows.sort((a,b)=>a.date.localeCompare(b.date)||a.park.localeCompare(b.park)).map(d=>[d.date,OWNER_PARKS[d.park].name,d.attendance,reais(d.revenueCents),reais(d.costCents),reais(d.resultCents),states[d.state],d.revision,d.source==='unavailable'?'Indisponível':d.source,d.asOf])},
 {title:'Subtotais conhecidos',headers:['Data','Parque','Receita parcial (R$)','Entradas registradas','Observação'],moneyColumns:[2],rows:rows.filter(d=>d.source!=='unavailable'&&(d.revenueCents===null||d.attendance===null)).map(d=>[d.date,OWNER_PARKS[d.park].name,reais(d.knownRevenueCents),d.knownAttendance,'Subtotal dos registros disponíveis. Não representa o total do dia.'])},
 {title:'Pendências',headers:['Parque','Observação'],moneyColumns:[],rows:data.parks.flatMap(p=>[...new Set(rows.filter(d=>d.park===p).flatMap(d=>d.warnings))].map(w=>[OWNER_PARKS[p].name,w]))}];
}
function title(data:OwnerDashboard){return `Rincão + Estância · ${data.period.current.start.slice(0,7)} · ${data.parks.map(p=>OWNER_PARKS[p].name).join(' e ')}`;}
function chartData(data:OwnerDashboard,metric:'attendance'|'revenueCents'){
 const groups=ownerDates(data.period.current).map(date=>({date,items:data.parks.map(park=>({park,value:data.days.find(d=>d.park===park&&d.date===date)?.[metric]??null}))}));
 return {groups,maximum:Math.max(1,...groups.map(g=>g.items.reduce((sum,p)=>sum+(p.value??0),0))),width:500/groups.length};
}
export async function renderOwnerXlsx(data:OwnerDashboard,by:string){
 const book=new ExcelJS.Workbook();book.creator=by;book.created=new Date(data.generatedAt);
 for(const section of ownerExportSections(data)){
  const sheet=book.addWorksheet(section.title);sheet.addRow([title(data)]);sheet.addRow([safeSpreadsheetText(`Consulta ${data.generatedAt} · Gerado por ${by} · Ausente = indisponível, nunca zero. Receita por visita; público por entrada efetiva.`)]);sheet.addRow(section.headers);
  sheet.getRow(3).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(3).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF183F61'}};
  section.rows.forEach(values=>{const row=sheet.addRow(values.map(v=>typeof v==='string'?safeSpreadsheetText(v):v));section.moneyColumns.forEach(i=>row.getCell(i+1).numFmt='#,##0.00;[Red]-#,##0.00');row.alignment={wrapText:true,vertical:'top'};});
  sheet.columns.forEach((c,i)=>c.width=section.headers[i]?.includes('Fonte')||section.headers[i]?.includes('Observação')?60:23);sheet.views=[{state:'frozen',ySplit:3}];sheet.autoFilter={from:{row:3,column:1},to:{row:3,column:section.headers.length}};sheet.pageSetup={paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0};
 }
 const chartSheet=book.addWorksheet('Gráficos');chartSheet.addRow([title(data)]);
 for(const [index,metric] of (['attendance','revenueCents'] as const).entries()){
  const {groups,maximum}=chartData(data,metric),width=750/groups.length;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="260"><rect width="800" height="260" fill="white"/><g font-family="sans-serif" font-size="12" fill="#183345"><text x="20" y="22">${metric==='attendance'?'Público':'Receita (centavos)'} · Rincão azul / Estância verde</text>${groups.map((g,i)=>{let offset=0;return g.items.map(p=>{const height=(p.value??0)/maximum*160;offset+=height;return `<rect x="${20+i*width}" y="${200-offset}" width="${Math.max(2,width-4)}" height="${height}" fill="${OWNER_PARKS[p.park].color}"/>`;}).join('')+`<text x="${20+i*width}" y="220">${g.date.slice(8)}${g.items.some(p=>p.value===null)?'*':''}</text>`;}).join('')}<text x="20" y="245">* informação incompleta. Totais e valores em reais nas tabelas.</text></g></svg>`;
  const imageId=book.addImage({base64:(await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64'),extension:'png'});chartSheet.addImage(imageId,{tl:{col:0,row:2+index*15},ext:{width:800,height:260}});
 }
 return Buffer.from(await book.xlsx.writeBuffer());
}
export async function renderOwnerPdf(data:OwnerDashboard,by:string){
 const sections=ownerExportSections(data);
 return renderToBuffer(<Document title={title(data)} language="pt-BR"><Page size="A4" style={{padding:30,paddingBottom:45,fontFamily:'Daily Report Rubik',fontSize:8,color:'#183345'}}>
  <View style={{flexDirection:'row',gap:20,marginBottom:12}}><PdfImage src={path.join(process.cwd(),'public/brand/rincao-logo.png')} style={{width:95,height:42,objectFit:'contain'}}/><PdfImage src={path.join(process.cwd(),'public/brand/estancia-logo-dark.png')} style={{width:95,height:42,objectFit:'contain'}}/></View>
  <Text style={{fontSize:17,fontWeight:700,marginBottom:10}}>{title(data)}</Text><Text style={{marginBottom:12}}>Gerado por {by} em {data.generatedAt}. Período: {data.period.current.start} a {data.period.current.end}. Receita por visita; público por entrada efetiva. Valores fechados preservam sua revisão; dias abertos são provisórios. Indisponível não significa zero.</Text>
  {(['attendance','revenueCents'] as const).map(metric=>{const {groups,maximum,width}=chartData(data,metric);return <View key={metric} wrap={false} style={{marginBottom:16}}><Text style={{fontWeight:700,marginBottom:6}}>{metric==='attendance'?'Público por dia':'Receita por dia'} · Rincão azul / Estância verde</Text><Svg width={500} height={85}>{groups.flatMap((g,i)=>{let offset=0;return g.items.map(p=>{const height=(p.value??0)/maximum*70;offset+=height;return <Rect key={`${p.park}-${g.date}`} x={i*width+1} y={75-offset} width={Math.max(2,width-3)} height={height} fill={OWNER_PARKS[p.park].color}/>;});})}</Svg><View style={{flexDirection:'row',width:500}}>{groups.map(g=><Text key={g.date} style={{width,fontSize:6,textAlign:'center'}}>{g.date.slice(8)}{g.items.some(p=>p.value===null)?'*':''}</Text>)}</View><Text style={{marginTop:5}}>* Informação incompleta. Consulte os valores e a situação de cada dia na tabela.</Text></View>;})}
  {sections.map(section=><View key={section.title} style={{marginBottom:16}}><Text minPresenceAhead={30} style={{fontSize:12,fontWeight:700,marginBottom:6}}>{section.title}</Text>{!section.rows.length?<Text>Nenhum registro.</Text>:section.rows.map((values,i)=><View key={i} wrap={false} style={{paddingVertical:5,borderBottom:'0.5 solid #dce4e9'}}><Text hyphenationCallback={w=>w.length>40?Array.from(w):[w]}>{values.map((v,j)=>`${section.headers[j]}: ${v===null?'Indisponível':section.moneyColumns.includes(j)?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v as number):v}`).join(' · ')}</Text></View>)}</View>)}
  <Text fixed style={{position:'absolute',bottom:20,left:30,right:30,fontSize:7}} render={({pageNumber,totalPages})=>`${title(data)} · ${pageNumber}/${totalPages}`}/>
 </Page></Document>);
}
