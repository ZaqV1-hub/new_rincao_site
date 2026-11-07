import React from "react";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { describeChargebackIssue, type ChargebackEvidence } from "@/lib/chargeback-dossier";

const MAX_BYTES = 8_000_000;
const MAX_PAGES = 10;

const styles = StyleSheet.create({
  page: { padding: 34, paddingBottom: 46, fontFamily: "Helvetica", fontSize: 9, color: "#183c62" },
  header: { borderBottom: "2 solid #173f68", paddingBottom: 12, marginBottom: 12 },
  brand: { fontSize: 9, fontWeight: "bold", marginBottom: 7 },
  title: { fontSize: 17, fontWeight: "bold", lineHeight: "22pt" },
  heading: { backgroundColor: "#173f68", color: "#ffffff", fontWeight: "bold", padding: 6, marginTop: 10 },
  line: { padding: 5, borderBottom: "1 solid #d3dce5", lineHeight: "12pt" },
  note: { marginTop: 7, marginBottom: 3, color: "#536b80", lineHeight: "13pt" },
  footer: {
    position: "absolute", left: 34, right: 34, bottom: 23, color: "#536b80",
    borderTop: "1 solid #d3dce5", paddingTop: 5, fontSize: 8, textAlign: "right",
  },
});

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const voucherState = {
  used: "Utilizado",
  available: "Disponível",
  invalidated: "Invalidado",
  unknown: "Sem informação",
};
const auditAction: Record<string, string> = {
  validar: "Validação",
  desvalidar: "Desvalidação",
  invalidar: "Invalidação",
  sent: "Envio aceito pelo serviço",
  skipped: "Envio ignorado pelo serviço",
  failed: "Falha de envio",
};
const auditMode: Record<string, string> = {
  voucher_number: "por código do ingresso",
  selection: "por seleção",
  purchase: "por compra",
  school_trip: "por passeio escolar",
};
const auditTrigger: Record<string, string> = {
  payment_reconciliation: "conciliação do pagamento",
  delivery_recovery: "recuperação de entrega",
};

function display(value: string | number | null | undefined) {
  return value === "" || value === null || value === undefined ? "Indisponível" : String(value);
}

function money(cents: number | null | undefined) {
  return cents === null || cents === undefined ? "Indisponível" : currency.format(cents / 100);
}

function Heading({ children }: { children: React.ReactNode }) {
  return <Text style={styles.heading} minPresenceAhead={40}>{children}</Text>;
}

function Line({ children }: { children: React.ReactNode }) {
  return <Text style={styles.line}>{children}</Text>;
}

function Dossier({ evidence }: { evidence: ChargebackEvidence }) {
  const chargeback = evidence.case;
  const transaction = chargeback.transactionDetails;
  const purchase = evidence.purchase;
  const used = evidence.vouchers.filter((voucher) => voucher.state === "used").length;
  const available = evidence.vouchers.filter((voucher) => voucher.state === "available").length;
  const invalidated = evidence.vouchers.filter((voucher) => voucher.state === "invalidated").length;
  const unknown = evidence.vouchers.length - used - available - invalidated;
  const usage = used === 0 ? "Sem ingressos marcados como utilizados" :
    used === evidence.vouchers.length ? "Todos os ingressos marcados como utilizados" : "Uso parcial registrado";
  const capturedAt = new Date(evidence.capturedAt);

  return (
    <Document
      title="Dossiê de contestação — compra e utilização de ingressos"
      author="Parque Rincão"
      creationDate={capturedAt}
      modificationDate={capturedAt}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>PARQUE RINCÃO</Text>
          <Text style={styles.title}>Dossiê de contestação — compra e utilização de ingressos</Text>
          <Text style={styles.note}>Captura dos registros do sistema em {evidence.capturedAt} (UTC)</Text>
        </View>

        <Heading>Caso e transação informados pela Cielo</Heading>
        <Line>Caso {display(chargeback.idCase)} · Contestação {display(chargeback.idChargeback)} · EC {display(chargeback.establishmentNumber)}</Line>
        <Line>Processo {display(chargeback.process)} · Motivo {display(chargeback.chargebackDetails.reasonCode)} · {display(chargeback.chargebackDetails.reasonDescription)}</Line>
        <Line>Prazo {display(chargeback.treatmentDeadline)} · Valor da transação {display(chargeback.transactionAmount)} · Moeda {display(transaction.currency)}</Line>
        <Line>Data da transação {display(transaction.transactionDate)} · Bandeira {display(transaction.cardAssociationName)} · Cartão {display(transaction.truncatedCard)}</Line>
        <Line>TID {display(transaction.tid)} · NSU {display(transaction.nsu)} · Autorização {display(transaction.authorization)}</Line>

        <Heading>Compra e cobrança correlacionadas</Heading>
        <Line>Compra {display(evidence.purchaseId)} · PaymentId {display(evidence.paymentId)}</Line>
        <Line>Vínculo {evidence.link?.method === "tid" ? "TID exato" : evidence.link ? "NSU, autorização e data" : "indisponível"} · Comparação do EC no registro do pagamento {evidence.link?.establishmentVerified ? "confirmada" : "indisponível"}</Line>
        <Line>Registro atual da compra · Data {display(purchase?.date)} · Situação {display(purchase?.status)} · Total {money(purchase?.totalCents)}</Line>
        <Line>Cadastro atual do comprador · Nome {display(purchase?.buyerName)} · E-mail {display(purchase?.buyerEmail)}</Line>

        <Heading>Registros de pagamento — conciliação armazenada</Heading>
        {evidence.paymentAttempts.length === 0 && <Line>Indisponíveis</Line>}
        {evidence.paymentAttempts.map((payment, index) => !("id" in payment) || payment.id !== evidence.paymentId ? (
          <Line key={`tentativa-${index}`}>Outra tentativa · Situação Cielo {display(payment.status)} · Situação do registro local {display(payment.ledgerStatus)} · Valor {money(payment.amountCents)}</Line>
        ) : (
          <View key={`${payment.id}-${index}`}>
            <Line>PaymentId {display(payment.id)} · Cobrança correlacionada · Valor {money(payment.amountCents)} · Parcelas {display(payment.installments)}</Line>
            <Line>Situação Cielo {display(payment.status)} · Situação do registro local {display(payment.ledgerStatus)} · Recebida {display(payment.receivedAt)} · Capturada {display(payment.capturedAt)}</Line>
            <Line>EC {display(payment.establishment)} · TID {display(payment.tid)} · NSU {display(payment.nsu)} · Autorização {display(payment.authorization)}</Line>
            <Line>Bandeira {display(payment.brand)} · Final do cartão {display(payment.lastFour)} · ECI 3DS informado {display(payment.eci)}</Line>
            <Line>Comprador no registro da transação · Nome {display(payment.buyerName)} · E-mail {display(payment.buyerEmail)}</Line>
            <Line>Cancelamento/estorno {payment.reversalRecorded ? "registrado" : "sem indicação no registro capturado"} · Valor informado {money(payment.reversedCents)}</Line>
          </View>
        ))}

        <Heading>Consulta autenticada à API e-commerce Cielo</Heading>
        {evidence.livePayment ? (
          <View>
            <Line>Consulta em {display(evidence.livePaymentCheckedAt)} (UTC)</Line>
            <Line>PaymentId {display(evidence.livePayment.id)} · Situação {display(evidence.livePayment.status)} · Capturada {display(evidence.livePayment.capturedAt)} · Valor {money(evidence.livePayment.amountCents)}</Line>
            <Line>EC {display(evidence.livePayment.establishment)} · ECI 3DS informado {display(evidence.livePayment.eci)} · Cancelamento/estorno {evidence.livePayment.reversalRecorded ? "registrado" : "sem indicação na consulta"} · Valor informado {money(evidence.livePayment.reversedCents)}</Line>
          </View>
        ) : <Line>Consulta recente indisponível</Line>}

        <Heading>Ingressos — estado atual e agenda no momento da captura</Heading>
        <Line>{usage} · {used} utilizados · {available} disponíveis · {invalidated} invalidados · {unknown} sem informação</Line>
        {evidence.vouchers.length === 0 && <Line>Ingressos indisponíveis</Line>}
        {evidence.vouchers.map((voucher) => (
          <View key={voucher.id}>
            <Line>Ingresso {display(voucher.number)} (ID {voucher.id}) · {display(voucher.category)} · Visita prevista {display(voucher.visitDate)} · {money(voucher.unitCents)}</Line>
            <Line>{voucherState[voucher.state]} · {voucher.state === "invalidated" ? `Invalidação ${display(voucher.invalidatedAt)}` : `Utilização ${display(voucher.usedAt)}`}</Line>
          </View>
        ))}
        <Text style={styles.note}>Os horários dos ingressos são apresentados conforme o registro local. A validação é um registro operacional associado ao ingresso. A identidade de quem utilizou o ingresso é indisponível nestes registros.</Text>

        <Heading>Histórico operacional — edicoes_log do sistema de ingressos</Heading>
        {evidence.voucherEvents.length === 0 && <Line>Nenhum evento pertinente disponível</Line>}
        {evidence.voucherEvents.map((event) => (
          <Line key={event.id}>Evento {event.id} · {display(event.occurredAt)} · {display(auditAction[event.action])} · Modo {display(auditMode[event.mode])} · Operador {display(event.actor)} · Ingressos (IDs) {display(event.voucherIds.join(", "))}</Line>
        ))}

        <Heading>Entrega — registros do serviço de ingressos e fila de e-mail</Heading>
        <Line>Captura dos registros de comunicação {display(evidence.communicationsCapturedAt)} (UTC)</Line>
        <Line>Indicador de enfileiramento do e-mail {evidence.emailQueued === null ? "indisponível" : evidence.emailQueued ? "registrado" : "não registrado"}</Line>
        {evidence.deliveryEvents.length === 0 && <Line>Nenhum evento pertinente disponível</Line>}
        {evidence.deliveryEvents.map((event) => (
          <Line key={event.id}>Evento {event.id} · {display(event.occurredAt)} · {display(auditAction[event.action])} · Gatilho {display(auditTrigger[event.trigger])} · Ingressos (IDs) {display(event.voucherIds.join(", "))}</Line>
        ))}
        <Text style={styles.note}>Os registros de entrega representam o retorno do serviço e o enfileiramento do e-mail. A leitura pelo destinatário é indisponível.</Text>
        {evidence.issues.length > 0 && (
          <View>
            <Heading>Lacunas e inconsistências da coleta</Heading>
            {evidence.issues.map((issue) => <Line key={issue}>{describeChargebackIssue(issue)}</Line>)}
          </View>
        )}
        <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) =>
          `Caso ${chargeback.idCase} · Página ${pageNumber}/${totalPages}`
        } />
      </Page>
    </Document>
  );
}

export async function renderChargebackDossierPdf(evidence: ChargebackEvidence): Promise<Buffer> {
  const file = await renderToBuffer(<Dossier evidence={evidence} />);
  if (file.byteLength > MAX_BYTES) throw new Error("chargeback_pdf_size_limit");

  // React PDF/PDFKit writes each page dictionary outside compressed streams.
  const pages = file.toString("latin1").match(/^\/Type \/Page$/gm)?.length ?? 0;
  if (pages === 0) throw new Error("chargeback_pdf_invalid");
  if (pages > MAX_PAGES) throw new Error("chargeback_pdf_page_limit");
  return file;
}
