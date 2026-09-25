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
  title: { flexGrow: 1, paddingHorizontal: 8, textAlign: "center", fontSize: 14, fontWeight: "bold" },
  orderBox: { width: 90, border: "1 solid #aebdcb", borderRadius: 4, textAlign: "center", padding: 6 },
  orderLabel: { fontSize: 6, fontWeight: "bold" },
  orderValue: { marginTop: 3, fontSize: 12, fontWeight: "bold" },
  section: { marginBottom: 9 },
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
  vouchersHeader: { flexDirection: "row", marginTop: 0 },
  voucherHeading: { backgroundColor: "#173f68", color: "#ffffff", fontSize: 6, fontWeight: "bold", padding: 4 },
  voucherCell: { border: "1 solid #d3dce5", fontSize: 6.3, paddingHorizontal: 3, paddingVertical: 4, justifyContent: "center" },
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
  footer: { marginTop: 7, borderTop: "1 solid #d3dce5", paddingTop: 5, color: "#5f7488", textAlign: "center", fontSize: 6 },
});

const voucherColumns = [
  { label: "ID", width: "7%" },
  { label: "CÓDIGO", width: "10%" },
  { label: "DATA DA VISITA", width: "11%" },
  { label: "TIPO", width: "14%" },
  { label: "ESCOLA", width: "13%" },
  { label: "TURMA", width: "10%" },
  { label: "PERÍODO", width: "8%" },
  { label: "VALOR", width: "8%" },
  { label: "STATUS", width: "8%" },
  { label: "USO", width: "11%" },
];

function display(value: string | null | undefined, maxLength = 20) {
  const text = String(value ?? "-").trim() || "-";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function usageLabel(voucher: PainelPurchaseDetail["vouchers"][number]) {
  if (voucher.usedLabel.toLowerCase() !== "sim") return "-";
  const date = voucher.usedDate ?? "";
  const time = voucher.usedTime?.slice(0, 5) ?? "";
  return display([date, time].filter(Boolean).join(" "), 19);
}

function paidStatus(status: string) {
  const normalized = status.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return normalized.includes("conclu") || normalized.includes("paga") || normalized.includes("pago");
}

function PurchaseSummary({ detail }: { detail: PainelPurchaseDetail }) {
  const rowFontSize = detail.vouchers.length > 22 ? 5 : detail.vouchers.length > 14 ? 5.6 : 6.3;
  const rowPadding = detail.vouchers.length > 22 ? 2 : 4;
  const paymentIsPaid = paidStatus(detail.statusLabel);

  return (
    <Document title={`Resumo da compra ${detail.purchaseId}`}>
      <Page size="A4" style={styles.page} wrap={false}>
        <View style={styles.header}>
          <View>
            <Image
              src={resolve(process.cwd(), "public", "brand", "rincao-logo.png")}
              style={styles.brand}
            />
          </View>
          <Text style={styles.title}>RESUMO DA COMPRA DE INGRESSOS</Text>
          <View style={styles.orderBox}>
            <Text style={styles.orderLabel}>Nº DO PEDIDO</Text>
            <Text style={styles.orderValue}>{detail.purchaseId}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DADOS DA COMPRA / RESERVA</Text>
          <View style={styles.row}>
            <View style={[styles.cell, { width: "34%" }]}>
              <Text style={styles.label}>Data da compra</Text>
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
          <View style={styles.vouchersHeader}>
            {voucherColumns.map((column) => (
              <Text key={column.label} style={[styles.voucherHeading, { width: column.width }]}>
                {column.label}
              </Text>
            ))}
          </View>
          {detail.vouchers.length ? detail.vouchers.map((voucher, index) => {
            const cells = [
              String(voucher.voucherId),
              voucher.voucherNumber,
              voucher.visitDate,
              voucher.voucherTypeLabel,
              voucher.schoolName,
              voucher.className,
              voucher.periodName,
              voucher.unitValue,
              voucher.usedLabel,
              usageLabel(voucher),
            ];

            return (
              <View key={voucher.voucherId} style={[styles.row, { minHeight: detail.vouchers.length > 22 ? 10 : 15 }]} wrap={false}>
                {cells.map((cell, cellIndex) => (
                  <Text
                    key={voucherColumns[cellIndex].label}
                    style={[
                      styles.voucherCell,
                      { width: voucherColumns[cellIndex].width, fontSize: rowFontSize, paddingVertical: rowPadding },
                      index % 2 === 1 ? { backgroundColor: "#f3f6f9" } : {},
                    ]}
                  >
                    {display(cell, 21)}
                  </Text>
                ))}
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

        <Text style={styles.footer}>
          Resumo para conferência da compra. Este documento não substitui documento fiscal.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderPainelPurchaseSummaryPdf(detail: PainelPurchaseDetail) {
  return renderToBuffer(<PurchaseSummary detail={detail} />);
}
