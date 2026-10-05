/* eslint-disable jsx-a11y/alt-text */

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PainelPurchaseDetail } from "@/lib/painel-compras";

const styles = StyleSheet.create({
  page: {
    paddingTop: 25,
    paddingHorizontal: 27,
    paddingBottom: 24,
    color: "#183c62",
    fontFamily: "Helvetica",
    fontSize: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "2 solid #173f68",
    paddingBottom: 10,
    marginBottom: 12,
  },
  brand: { width: 120, height: 55, objectFit: "contain" },
  brandSlot: { width: 120, flexShrink: 0, alignItems: "flex-start", justifyContent: "center" },
  title: { flexGrow: 1, paddingHorizontal: 8, textAlign: "center", fontSize: 14, fontWeight: "bold" },
  subtitle: { fontSize: 9, fontWeight: "normal", marginTop: 5, color: "#263b53" },
  orderBox: { width: 102, border: "1 solid #aebdcb", borderRadius: 4, textAlign: "center" },
  orderLabel: { fontSize: 6, fontWeight: "bold" },
  orderValue: { marginTop: 3, fontSize: 10, fontWeight: "bold" },
  orderPart: { padding: 6 },
  orderDivider: { borderTop: "1 solid #d3dce5" },
  section: { marginBottom: 8 },
  sectionTitle: {
    backgroundColor: "#173f68",
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "bold",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  row: { flexDirection: "row" },
  cell: { flexGrow: 1, border: "1 solid #d3dce5", padding: 6, justifyContent: "center" },
  label: { color: "#536b80", fontSize: 6, marginBottom: 3 },
  value: { color: "#183c62", fontSize: 8, fontWeight: "bold" },
  paid: { color: "#22854b" },
  pending: { color: "#bf7218" },
  voucherCard: { border: "1 solid #c8d8e6", borderRadius: 4, marginTop: 5, padding: 7 },
  voucherTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  voucherMeta: { flexDirection: "row", marginTop: 5 },
  voucherField: { marginRight: 12, flexShrink: 1 },
  voucherLabel: { color: "#60788f", fontSize: 6, marginBottom: 2 },
  voucherValue: { color: "#173f68", fontSize: 8, fontWeight: "bold" },
  voucherUsed: { backgroundColor: "#f0f1f2", borderColor: "#d0d4d8" },
  voucherUsedText: { color: "#6f7881" },
  voucherAvailable: { backgroundColor: "#f5fbf7", borderColor: "#b7d9c3" },
  voucherAvailableText: { color: "#277144" },
  totalBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    border: "1 solid #cbd8e5",
    borderRadius: 4,
    backgroundColor: "#f3f7fb",
    padding: 7,
    marginTop: 7,
    fontSize: 8,
    fontWeight: "bold",
  },
  usedNotice: { flexDirection: "row", alignItems: "center", border: "1 solid #cfd5db", borderRadius: 5, backgroundColor: "#f2f3f4", padding: 10, marginTop: 8 },
  usedIcon: { width: 44, height: 44, border: "2 solid #84909b", borderRadius: 22, color: "#84909b", textAlign: "center", fontSize: 26, fontWeight: "bold", marginRight: 14 },
  usedTitle: { color: "#586674", fontSize: 14, fontWeight: "bold", marginBottom: 5 },
  usedText: { color: "#263b53", fontSize: 7.5, marginBottom: 4 },
  footer: { marginTop: 7, borderTop: "1 solid #d3dce5", paddingTop: 5, color: "#5f7488", textAlign: "center", fontSize: 6 },
});

const logoSource = `data:image/png;base64,${readFileSync(
  resolve(process.cwd(), "public", "brand", "rincao-logo.png"),
).toString("base64")}`;

function display(value: string | null | undefined, maxLength = 20) {
  const text = String(value ?? "-").trim() || "-";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function paidStatus(status: string) {
  const normalized = status.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return normalized.includes("conclu") || normalized.includes("paga") || normalized.includes("pago");
}

function PurchaseSummary({ detail }: { detail: PainelPurchaseDetail }) {
  const paymentIsPaid = paidStatus(detail.statusLabel);
  const usedVouchers = detail.vouchers.filter((voucher) => voucher.usedLabel.toLowerCase() === "sim");
  const usedDates = [...new Set(usedVouchers.map((voucher) => voucher.usedDate).filter(Boolean))];
  const usedTimes = usedVouchers.map((voucher) => voucher.usedTime).filter((value): value is string => Boolean(value)).sort();

  return (
    <Document title={`Resumo da compra ${detail.purchaseId}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandSlot}>
            <Image
              src={logoSource}
              style={styles.brand}
            />
          </View>
          <View style={{ flexGrow: 1, alignItems: "center", paddingHorizontal: 8 }}>
            <Text style={styles.title}>NOTA FISCAL / COMPROVANTE{"\n"}DE COMPRA DE INGRESSOS</Text>
            <Text style={styles.subtitle}>Documento de registro da compra e utilização</Text>
          </View>
          <View style={styles.orderBox}>
            <View style={styles.orderPart}>
              <Text style={styles.orderLabel}>Nº DO PEDIDO</Text>
              <Text style={styles.orderValue}>{detail.purchaseId}</Text>
            </View>
            <View style={[styles.orderPart, styles.orderDivider]}>
              <Text style={styles.orderLabel}>DATA DA COMPRA</Text>
              <Text style={styles.orderValue}>{detail.purchaseDate ?? "-"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DADOS DA COMPRA / RESERVA</Text>
          <View style={styles.row}>
            <View style={[styles.cell, { width: "34%" }]}>
              <Text style={styles.label}>Data</Text>
              <Text style={styles.value}>{detail.purchaseDate ?? "-"}</Text>
            </View>
            <View style={[styles.cell, { width: "28%" }]}>
              <Text style={styles.label}>Tipo</Text>
              <Text style={styles.value}>{detail.typeLabel}</Text>
            </View>
            <View style={[styles.cell, { width: "38%" }]}>
              <Text style={styles.label}>Status</Text>
              <Text style={[styles.value, paymentIsPaid ? styles.paid : styles.pending]}>
                {detail.statusLabel}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DADOS DO CLIENTE</Text>
          <View style={styles.row}>
            <View style={[styles.cell, { width: "65%" }]}>
              <Text style={styles.label}>Cliente</Text>
              <Text style={styles.value}>{detail.userName ?? "-"}</Text>
            </View>
            <View style={[styles.cell, { width: "35%" }]}>
              <Text style={styles.label}>CPF</Text>
              <Text style={styles.value}>{detail.cpf ?? "-"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PAGAMENTO</Text>
          <View style={styles.row}>
            <View style={[styles.cell, { width: "18%" }]}>
              <Text style={styles.label}>Status</Text>
              <Text style={[styles.value, paymentIsPaid ? styles.paid : styles.pending]}>
                {detail.paymentLabel}
              </Text>
            </View>
            <View style={[styles.cell, { width: "22%" }]}>
              <Text style={styles.label}>Forma de pagamento</Text>
              <Text style={styles.value}>{detail.paymentMethodLabel}</Text>
            </View>
            <View style={[styles.cell, { width: "18%" }]}>
              <Text style={styles.label}>Data do pagamento</Text>
              <Text style={styles.value}>{detail.paymentDate ?? "-"}</Text>
            </View>
            <View style={[styles.cell, { width: "14%" }]}>
              <Text style={styles.label}>Hora</Text>
              <Text style={styles.value}>{detail.paymentTime ?? "-"}</Text>
            </View>
            <View style={[styles.cell, { width: "28%", backgroundColor: "#173f68" }]}>
              <Text style={[styles.label, { color: "#dce9f5" }]}>VALOR TOTAL</Text>
              <Text style={[styles.value, { color: "#ffffff", fontSize: 13 }]}>
                R$ {detail.totalValue}
              </Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={[styles.cell, { width: "62%" }]}>
              <Text style={styles.label}>ID do pagamento</Text>
              <Text style={styles.value}>{display(detail.gatewayPaymentId, 58)}</Text>
            </View>
            <View style={[styles.cell, { width: "38%" }]}>
              <Text style={styles.label}>Processadora</Text>
              <Text style={styles.value}>{detail.paymentLabel.split(" - ")[0] || "-"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>VOUCHERS (INGRESSOS)</Text>
          {detail.vouchers.length ? detail.vouchers.map((voucher) => {
            const used = voucher.usedLabel.toLowerCase() === "sim";
            return (
              <View
                key={voucher.voucherId}
                style={[styles.voucherCard, used ? styles.voucherUsed : styles.voucherAvailable]}
                wrap={false}
              >
                <View style={styles.voucherTop}>
                  <Text style={[styles.voucherValue, used ? styles.voucherUsedText : {}]}>
                    Voucher #{voucher.voucherId} · {voucher.voucherNumber || "Sem código"}
                  </Text>
                  <Text style={[styles.voucherValue, used ? styles.voucherUsedText : styles.voucherAvailableText]}>
                    {used ? "USADO" : "NÃO USADO"}
                  </Text>
                </View>
                <View style={styles.voucherMeta}>
                  <View style={[styles.voucherField, { width: "28%" }]}>
                    <Text style={styles.voucherLabel}>DATA DA VISITA</Text>
                    <Text style={[styles.voucherValue, used ? styles.voucherUsedText : {}]}>{voucher.visitDate || "-"}</Text>
                  </View>
                  <View style={[styles.voucherField, { width: "44%" }]}>
                    <Text style={styles.voucherLabel}>TIPO</Text>
                    <Text style={[styles.voucherValue, used ? styles.voucherUsedText : {}]}>{voucher.voucherTypeLabel}</Text>
                  </View>
                  <View style={{ width: "20%" }}>
                    <Text style={styles.voucherLabel}>VALOR</Text>
                    <Text style={[styles.voucherValue, used ? styles.voucherUsedText : {}]}>R$ {voucher.unitValue}</Text>
                  </View>
                </View>
                {voucher.schoolName || voucher.studentName || voucher.className ? (
                  <View style={{ marginTop: 6, borderTop: "1 solid #d5e1e9", paddingTop: 5 }}>
                    {voucher.schoolName ? (
                      <View style={styles.voucherField}>
                        <Text style={styles.voucherLabel}>ESCOLA</Text>
                        <Text style={[styles.voucherValue, used ? styles.voucherUsedText : {}]}>{voucher.schoolName}</Text>
                      </View>
                    ) : null}
                    {voucher.studentName ? (
                      <View style={[styles.voucherField, { marginTop: 5 }]}>
                        <Text style={styles.voucherLabel}>ALUNO</Text>
                        <Text style={[styles.voucherValue, used ? styles.voucherUsedText : {}]}>{voucher.studentName}</Text>
                      </View>
                    ) : null}
                    {voucher.className ? (
                      <View style={[styles.voucherField, { marginTop: 5 }]}>
                        <Text style={styles.voucherLabel}>TURMA</Text>
                        <Text style={[styles.voucherValue, used ? styles.voucherUsedText : {}]}>{voucher.className}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                {used ? (
                  <Text style={[styles.voucherLabel, { marginTop: 6 }]}>
                    Utilizado em {voucher.usedDate || "data não informada"} às {voucher.usedTime || "horário não informado"}
                  </Text>
                ) : null}
              </View>
            );
          }) : (
            <Text style={{ border: "1 solid #d3dce5", padding: 8, fontSize: 7 }}>
              Nenhum voucher vinculado a esta compra.
            </Text>
          )}
          <View style={styles.totalBar}>
            <Text>Quantidade de ingressos: {detail.vouchers.length}</Text>
            <Text>Valor total: R$ {detail.totalValue}</Text>
          </View>
        </View>

        {usedVouchers.length > 0 ? (
          <View style={styles.usedNotice} wrap={false}>
            <Text style={styles.usedIcon}>!</Text>
            <View style={{ flexGrow: 1 }}>
              <Text style={styles.usedTitle}>
                {usedVouchers.length === detail.vouchers.length ? "INGRESSOS JÁ UTILIZADOS" : "INGRESSOS UTILIZADOS"}
              </Text>
              <Text style={styles.usedText}>
                {usedVouchers.length === detail.vouchers.length
                  ? "Todos os ingressos desta compra já foram utilizados."
                  : `${usedVouchers.length} de ${detail.vouchers.length} ingressos desta compra já foram utilizados.`}
                {usedDates.length ? ` Registro de uso em ${usedDates.join(", ")}.` : ""}
              </Text>
              <Text style={[styles.usedText, { color: "#586674", fontWeight: "bold" }]}>
                {usedVouchers.length === detail.vouchers.length
                  ? "ESTES INGRESSOS JÁ FORAM UTILIZADOS E NÃO PODERÃO SER UTILIZADOS NOVAMENTE."
                  : "OS INGRESSOS MARCADOS COMO UTILIZADOS NÃO PODERÃO SER UTILIZADOS NOVAMENTE."}
              </Text>
              {usedTimes.length ? (
                <Text style={styles.usedText}>
                  Horário de utilização: entre {usedTimes[0].slice(0, 8)} e {usedTimes[usedTimes.length - 1].slice(0, 8)}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <Text style={styles.footer}>
          Clube &amp; Park Rincão – Pousada e Lazer{"\n"}
          Este documento é um comprovante de registro da compra e utilização dos ingressos.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderPainelPurchaseSummaryPdf(detail: PainelPurchaseDetail) {
  return renderToBuffer(<PurchaseSummary detail={detail} />);
}
