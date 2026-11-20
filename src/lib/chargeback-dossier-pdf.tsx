import React from "react";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { describeChargebackIssue, evaluateChargebackEvidence, getChargebackAmounts, type ChargebackEvidence } from "@/lib/chargeback-dossier";
import { buildChargebackPurchaseSummary, dossierDate } from "@/lib/chargeback-presentation";
import { PurchaseSummaryPage } from "@/lib/painel-purchase-summary-pdf";

const MAX_BYTES = 8_000_000;
const MAX_PAGES = 10;
const styles = StyleSheet.create({
  page: { padding: 32, paddingBottom: 44, fontFamily: "Helvetica", fontSize: 9, color: "#183c62" },
  header: { borderBottom: "2 solid #173f68", paddingBottom: 12, marginBottom: 12 },
  brand: { fontSize: 9, fontWeight: "bold", marginBottom: 7 },
  title: { fontSize: 18, fontWeight: "bold", lineHeight: "22pt" },
  heading: { backgroundColor: "#173f68", color: "#fff", fontWeight: "bold", padding: 6, marginTop: 10, marginBottom: 4 },
  line: { paddingVertical: 4, borderBottom: "1 solid #d3dce5", lineHeight: "12pt" },
  note: { marginTop: 6, color: "#536b80", lineHeight: "12pt" },
  explanation: { marginTop: 7, lineHeight: "13pt" },
  footer: { position: "absolute", left: 34, right: 34, bottom: 23, color: "#536b80",
    borderTop: "1 solid #d3dce5", paddingTop: 5, fontSize: 8, textAlign: "right" },
});
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const money = (value: number | null | undefined) => value == null ? "Não informado" : currency.format(value / 100);
const display = (value: string | number | null | undefined) => value == null || value === "" ? "Não informado" : String(value);

function Heading({ children }: { children: React.ReactNode }) {
  return <View wrap={false} minPresenceAhead={45}><Text style={styles.heading}>{children}</Text></View>;
}
function Line({ children }: { children: React.ReactNode }) {
  return <Text style={styles.line}>{children}</Text>;
}

function Dossier({ evidence }: { evidence: ChargebackEvidence }) {
  const chargeback = evidence.case;
  const transaction = chargeback.transactionDetails;
  const payment = evidence.paymentAttempts.find((entry) => "id" in entry && entry.id === evidence.paymentId);
  const selected = payment && "id" in payment ? payment : null;
  const amounts = getChargebackAmounts(evidence);
  const evaluation = evaluateChargebackEvidence(evidence);
  const reviewIssues = evaluation.issues.filter((issue) => issue !== "case_not_pending");
  const used = evidence.vouchers.filter((voucher) => voucher.state === "used");
  const useDates = [...new Set(used.map((voucher) => voucher.usedAt?.slice(0, 10)).filter((date): date is string => Boolean(date)))].sort();
  const receiptDate = chargeback.chargebackDetails.receptionDate;
  const allUsed = used.length > 0 && used.length === evidence.vouchers.length && used.every((voucher) => Boolean(voucher.usedAt));
  const usedBeforeReceipt = allUsed && Boolean(receiptDate) &&
    useDates.every((date) => date < receiptDate!);
  const fraud = ["104", "10.4", "4837", "83"].includes(chargeback.chargebackDetails.reasonCode);
  const capturedAt = new Date(evidence.capturedAt);
  return (
    <Document title={`Contestação ${chargeback.idCase} - resumo da compra e análise`} author="Parque Rincão"
      creationDate={capturedAt} modificationDate={capturedAt}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>CLUBE &amp; PARK RINCÃO</Text>
          <Text style={styles.title}>Dossiê de contestação</Text>
          {evidence.purchaseId && evidence.purchase && <Text style={styles.note}>O Comprovante de Compra de Ingressos está na próxima página.</Text>}
          <Text style={styles.note}>Caso Cielo {chargeback.idCase} · Compra {display(evidence.purchaseId)}</Text>
        </View>

        <Heading>Compra, pagamento e contestação</Heading>
        <Line>Compra realizada em {dossierDate(evidence.purchase?.date)}{evidence.purchase?.time ? ` às ${evidence.purchase.time.slice(0, 8)}` : ""}.</Line>
        <Line>Pagamento em {dossierDate(selected?.capturedAt || transaction.transactionDate)} · Bandeira {display(transaction.cardAssociationName)} · Cartão {display(transaction.truncatedCard)} · {display(selected?.installments)} parcela(s).</Line>
        <Line>Utilização dos ingressos em {useDates.length ? useDates.map(dossierDate).join(", ") : "data não informada"} · {used.length} de {evidence.vouchers.length} ingresso(s) utilizado(s).</Line>
        <Line>Recebimento da contestação na Cielo em {dossierDate(receiptDate)}.</Line>
        <Line>Primeiro registro da contestação no Rincão em {dossierDate(evidence.firstNotifiedAt)}.</Line>
        <Line>Motivo informado pela Cielo · {display(chargeback.chargebackDetails.reasonDescription)} (código {display(chargeback.chargebackDetails.reasonCode)}).</Line>
        <Line>Prazo para apresentar a defesa · {dossierDate(chargeback.treatmentDeadline)}.</Line>
        {!receiptDate && <Text style={styles.note}>A Cielo não informou a data de recebimento neste retorno. A data do primeiro registro no Rincão identifica quando a integração recebeu o caso. A data em que o portador abriu a contestação no banco não está disponível.</Text>}

        <Heading>Composição do valor cobrado</Heading>
        <Line>Ingressos da compra · {money(amounts.baseCents)}</Line>
        <Line>Juros de parcelamento registrados · {money(amounts.feeCents)}</Line>
        <Line>Total cobrado e contestado · {money(amounts.chargedCents)}</Line>
        <Text style={styles.explanation}>
          {amounts.verifiedQuote
            ? `O registro do parcelamento confirma ${money(amounts.baseCents)} em ingressos e ${money(amounts.feeCents)} de juros, totalizando ${money(amounts.chargedCents)}. A diferença corresponde aos juros da compra em ${selected?.installments} parcela(s).`
            : amounts.reconciled
              ? "O valor dos ingressos coincide com o valor da cobrança."
              : "Há divergência entre os valores dos ingressos e da cobrança. A composição ainda precisa ser conferida antes da apresentação da defesa."}
        </Text>

        <Heading>Manifestação para análise da contestação</Heading>
        <Text style={styles.explanation}>
          {allUsed
            ? `Os registros do Rincão indicam a utilização dos ${used.length} ingressos desta compra em ${useDates.map(dossierDate).join(", ")}. O resumo de compra anexo apresenta os códigos dos ingressos, os valores e os horários de utilização.`
            : `Foram utilizados ${used.length} de ${evidence.vouchers.length} ingressos. O uso integral do serviço não está demonstrado pelos registros disponíveis; o caso exige análise individual.`}
        </Text>
        {usedBeforeReceipt && <Text style={styles.explanation}>As datas registradas demonstram que os ingressos foram utilizados antes do recebimento da contestação pela Cielo.</Text>}
        <Text style={styles.explanation}>Solicitamos que o resumo da compra, a confirmação de pagamento, a composição financeira e os registros de utilização sejam considerados na análise do caso.</Text>
        {fraud && <Text style={styles.note}>O motivo informado exige conferir a autorização do portador. A utilização dos ingressos demonstra o registro de acesso ao parque; a identidade de quem utilizou o serviço e a autorização do cartão precisam ser avaliadas com as evidências do banco e da Cielo.</Text>}

        <Heading>Identificação da cobrança</Heading>
        <Line>TID {display(transaction.tid)} · NSU {display(transaction.nsu)} · Autorização {display(transaction.authorization)}</Line>
        <Line>Pagamento {display(evidence.paymentId)} · Estabelecimento Cielo {display(chargeback.establishmentNumber)}</Line>
        {reviewIssues.length > 0 && <Text style={styles.note}>Pontos para revisão · {reviewIssues.map(describeChargebackIssue).join(" ")}</Text>}
        <Text style={styles.note}>Dados consultados em {dossierDate(evidence.capturedAt)}. Datas desconhecidas permanecem não informadas.</Text>
        <Text fixed style={styles.footer} render={({ pageNumber, totalPages }) => `Caso ${chargeback.idCase} · Página ${pageNumber}/${totalPages}`} />
      </Page>
      {evidence.purchaseId && evidence.purchase ? <PurchaseSummaryPage detail={buildChargebackPurchaseSummary(evidence)} /> : null}
    </Document>
  );
}

export async function renderChargebackDossierPdf(evidence: ChargebackEvidence): Promise<Buffer> {
  const file = await renderToBuffer(<Dossier evidence={evidence} />);
  if (file.byteLength > MAX_BYTES) throw new Error("chargeback_pdf_size_limit");
  const pages = file.toString("latin1").match(/^\/Type \/Page$/gm)?.length ?? 0;
  if (pages === 0) throw new Error("chargeback_pdf_invalid");
  if (pages > MAX_PAGES) throw new Error("chargeback_pdf_page_limit");
  return file;
}
