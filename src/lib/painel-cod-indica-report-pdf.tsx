import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { PainelCodIndicaReportData } from "@/lib/painel-cod-indica";

const styles = StyleSheet.create({
  page: {
    padding: 28,
    backgroundColor: "#ffffff",
    color: "#35503b",
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 18,
    borderBottom: "1 solid #cfe0ca",
    paddingBottom: 12,
  },
  logoTitle: {
    color: "#17351f",
    fontSize: 18,
    fontWeight: "bold",
  },
  logoSubtitle: {
    color: "#17351f",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  title: {
    color: "#17351f",
    fontSize: 18,
    fontWeight: "bold",
  },
  meta: {
    marginTop: 6,
    color: "#5b6f5e",
    fontSize: 10,
  },
  totalBox: {
    border: "1 solid #dbe7d7",
    padding: 10,
    marginBottom: 14,
    backgroundColor: "#f7fbf5",
  },
  totalLabel: {
    color: "#6a8b68",
    fontSize: 9,
    textTransform: "uppercase",
  },
  totalValue: {
    marginTop: 4,
    color: "#17351f",
    fontSize: 16,
    fontWeight: "bold",
  },
  table: {
    border: "1 solid #d9e3db",
  },
  row: {
    flexDirection: "row",
  },
  headerRow: {
    backgroundColor: "#2b8c46",
    color: "#ffffff",
    fontWeight: "bold",
  },
  cell: {
    borderRight: "1 solid #d9e3db",
    borderBottom: "1 solid #d9e3db",
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  colPurchase: { width: "10%" },
  colBuyer: { width: "22%" },
  colCpf: { width: "14%" },
  colDate: { width: "14%" },
  colValue: { width: "12%", textAlign: "right" },
  colDiscount: { width: "12%", textAlign: "right" },
  colCashback: { width: "12%", textAlign: "right" },
  colType: { width: "14%" },
});

function ReportDocument({ report }: { report: PainelCodIndicaReportData }) {
  return (
    <Document title={`cod-indica-${report.codigo}`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.logoTitle}>Estancia e Parque</Text>
          <Text style={styles.logoSubtitle}>Ecologica das Aguas</Text>
          <Text style={styles.title}>Relatorio de cashback - Cod Indica</Text>
          <Text style={styles.meta}>
            Codigo {report.codigo} • {report.representante} • Periodo{" "}
            {report.dateFromLabel} ate {report.dateToLabel}
          </Text>
        </View>

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Cashback total do periodo</Text>
          <Text style={styles.totalValue}>R$ {report.totalCashbackLabel}</Text>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.cell, styles.colPurchase]}>Compra</Text>
            <Text style={[styles.cell, styles.colBuyer]}>Titular</Text>
            <Text style={[styles.cell, styles.colCpf]}>CPF</Text>
            <Text style={[styles.cell, styles.colDate]}>Data pagto.</Text>
            <Text style={[styles.cell, styles.colValue]}>Valor</Text>
            <Text style={[styles.cell, styles.colDiscount]}>Desconto</Text>
            <Text style={[styles.cell, styles.colCashback]}>Cashback</Text>
            <Text style={[styles.cell, styles.colType]}>Tipo</Text>
          </View>
          {report.rows.map((row) => (
            <View key={row.purchaseId} style={styles.row}>
              <Text style={[styles.cell, styles.colPurchase]}>{row.purchaseId}</Text>
              <Text style={[styles.cell, styles.colBuyer]}>{row.buyerName}</Text>
              <Text style={[styles.cell, styles.colCpf]}>{row.cpfLabel}</Text>
              <Text style={[styles.cell, styles.colDate]}>{row.paymentDateLabel}</Text>
              <Text style={[styles.cell, styles.colValue]}>R$ {row.totalValueLabel}</Text>
              <Text style={[styles.cell, styles.colDiscount]}>
                R$ {row.discountValueLabel}
              </Text>
              <Text style={[styles.cell, styles.colCashback]}>
                R$ {row.cashbackValueLabel}
              </Text>
              <Text style={[styles.cell, styles.colType]}>{row.cashbackTypeLabel}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

export async function renderPainelCodIndicaReportPdfBuffer(
  report: PainelCodIndicaReportData,
) {
  return renderToBuffer(<ReportDocument report={report} />);
}
