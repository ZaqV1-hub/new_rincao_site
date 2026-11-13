import React from 'react';
import path from 'node:path';
import { Document,Font,Page,Text,View,renderToBuffer } from '@react-pdf/renderer';
import { COUNT_CATEGORIES,countCategories } from './trip-counting-contract';
import { TRIP_PAYMENT_METHODS } from './trip-settlement-contract';
import type { TripReceipt } from './trip-settlement';
Font.register({ family: 'Trip Receipt Rubik',fonts: [{ src: path.join(process.cwd(),'public/fonts/rubik-400.ttf') },{ src: path.join(process.cwd(),'public/fonts/rubik-700.ttf'),fontWeight: 700 }] });
const money = (cents: number) => new Intl.NumberFormat('pt-BR',{ style: 'currency',currency: 'BRL' }).format(cents/100);
const date = (value: string) => value.split('-').reverse().join('/');
export function buildTripReceiptLines(receipt: TripReceipt): string[] {
  const s = receipt.snapshot,c = s.calculation;
  if (!c || s.remainingCents !== 0 || s.pendingPaymentCents !== 0 || s.blockingIssues.length) throw new Error('Recibo incompleto: recebimento integral não comprovado.');
  return [
    `${s.clientName} · Visita: ${date(s.date)}`,
    `Representante: ${s.representative || 'Não informado'}`,
    `Veículos: ${s.vehicles.map(v => `${v.type === 'bus' ? 'Ônibus' : 'Van'} #${v.id}`).join(', ') || 'Nenhum'} · Pessoas contadas: ${Object.values(c.counts).reduce((sum,n) => sum+n,0)}`,
    ...[countCategories.slice(0,4),countCategories.slice(4)].map(categories => categories.map(category => `${COUNT_CATEGORIES[category].label}: ${c.counts[category]}`).join(' · ')),
    `Adultos cobrados: ${c.adultToCharge} × ${money(s.configuration.adultPriceCents!)} · Crianças cobradas: ${c.childToCharge} × ${money(s.configuration.childPriceCents!)}`,
    `Cortesias: ${s.configuration.adultCourtesies} adulto(s), ${s.configuration.childCourtesies} criança(s) · Outras categorias não cobradas: ${c.notChargedCount}`,
    `Pagos no site e presentes: ${money(c.onlinePresentCents)} · Reembolsos de ausentes: ${money(c.refundsDueCents)}`,
    `Cobrança da escola: ${money(c.schoolChargeCents)} · Recebido da escola: ${money(s.confirmedCents)}`,
    `Total do passeio: ${money(c.totalTripCents)}`,
    ...s.payments.filter(p => p.status === 'confirmed' && !p.reversed).map(p => `Recebimento #${p.id}: ${date(p.paymentDate)} · ${TRIP_PAYMENT_METHODS[p.method]} · ${money(p.amountCents)}${p.reference ? ` · ${p.reference}` : ''}${p.changeCents ? ` · Troco: ${money(p.changeCents)}` : ''}`),
    ...(s.warnings.length ? ['Finalização com exceção gerencial registrada. Consulte o histórico da operação.'] : []),
  ];
}
export async function renderTripReceiptPdf(receipt: TripReceipt): Promise<Buffer> {
  const lines = buildTripReceiptLines(receipt);
  return renderToBuffer(<Document title={`Recibo ${receipt.number} - Passeio`} language="pt-BR"><Page size="A4" style={{ padding: 28,fontFamily: 'Trip Receipt Rubik',fontSize: 8,color: '#173f68' }}>
    {['Via do Rincão','Via da escola'].map((copy,index) => <View key={copy} style={{ paddingTop: index ? 16 : 0,paddingBottom: 16,borderBottom: index === 0 ? '1 dashed #6b7d8e' : undefined }}>
      <View style={{ flexDirection: 'row',justifyContent: 'space-between',marginBottom: 10 }}><Text style={{ fontSize: 14,fontWeight: 700 }}>Rincão · Recibo nº {receipt.number}</Text><Text>{copy}</Text></View>
      {lines.map((line,i) => <Text key={i} style={{ marginBottom: 3,fontSize: 8,lineHeight: 1.1 }} hyphenationCallback={word => word.length > 45 ? Array.from(word) : [word]}>{line}</Text>)}
      <View style={{ marginTop: 16 }}><Text>____________________________________________________</Text><Text style={{ marginTop: 5 }}>{index === 0 ? 'Assinatura do responsável da escola' : 'Assinatura do Rincão'}</Text></View>
      <Text style={{ marginTop: 8,fontSize: 6,color: '#526b81' }}>Emitido em {new Intl.DateTimeFormat('pt-BR',{ timeZone: 'America/Sao_Paulo',dateStyle: 'short',timeStyle: 'short' }).format(new Date(receipt.createdAt))} por {receipt.actorName || 'Operador identificado'}. Registro original preservado. Este recibo não substitui documento fiscal.</Text>
      {index === 0 && <Text style={{ marginTop: 8,fontSize: 6,textAlign: 'center' }}>Linha de corte</Text>}
    </View>)}
  </Page></Document>);
}
