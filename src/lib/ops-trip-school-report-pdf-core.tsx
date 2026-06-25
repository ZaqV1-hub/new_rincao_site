import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type {
  OpsTripSchoolReportFilters,
  OpsTripSchoolReportIndicators,
  OpsTripSchoolReportParticipant,
  OpsTripSchoolReportStatusOption,
} from "@/lib/ops-trip-school-report-core";

type PdfTripReport = {
  trip: {
    code: string;
    dateLabel: string;
  };
  filters: OpsTripSchoolReportFilters;
  statusOptions: OpsTripSchoolReportStatusOption[];
  indicators: OpsTripSchoolReportIndicators;
  students: OpsTripSchoolReportParticipant[];
  educators: OpsTripSchoolReportParticipant[];
};

const styles = StyleSheet.create({
  page: {
    padding: 28,
    backgroundColor: "#f4f6f1",
    color: "#35503b",
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    border: "1 solid #cfe0ca",
    overflow: "hidden",
  },
  header: {
    backgroundColor: "#1f6b36",
    paddingHorizontal: 24,
    paddingVertical: 18,
    alignItems: "center",
  },
  logoTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
  },
  logoSubtitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
  },
  headerMeta: {
    marginTop: 8,
    color: "#dbeed5",
    fontSize: 10,
  },
  body: {
    padding: 20,
    gap: 14,
  },
  sectionTitle: {
    color: "#1f6b36",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricCard: {
    width: "31%",
    border: "1 solid #dbe7d7",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#f7fbf5",
  },
  metricValue: {
    color: "#17351f",
    fontSize: 14,
    fontWeight: "bold",
  },
  metricLabel: {
    marginTop: 4,
    color: "#5d7a62",
    fontSize: 9,
  },
  table: {
    border: "1 solid #d9e3db",
    borderRadius: 10,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#eef6ea",
    color: "#35503b",
    fontWeight: "bold",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderTop: "1 solid #e5ede2",
  },
  colVoucher: { width: "14%" },
  colName: { width: "28%" },
  colClass: { width: "22%" },
  colRole: { width: "16%" },
  colValue: { width: "10%", textAlign: "right" },
  colStatus: { width: "10%" },
  emptyState: {
    color: "#5d7a62",
  },
});

function ParticipantTable({
  title,
  rows,
  showClass,
}: {
  title: string;
  rows: OpsTripSchoolReportParticipant[];
  showClass: boolean;
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.length === 0 ? (
        <Text style={styles.emptyState}>Nenhum registro no filtro atual.</Text>
      ) : (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colVoucher}>Voucher</Text>
            <Text style={styles.colName}>Nome</Text>
            {showClass ? (
              <Text style={styles.colClass}>Turma</Text>
            ) : (
              <Text style={styles.colRole}>Funcao</Text>
            )}
            <Text style={styles.colValue}>Valor</Text>
            <Text style={styles.colStatus}>Status</Text>
          </View>
          {rows.map((row) => (
            <View key={row.voucherId} style={styles.tableRow}>
              <Text style={styles.colVoucher}>{row.voucherNumber}</Text>
              <Text style={styles.colName}>{row.name}</Text>
              {showClass ? (
                <Text style={styles.colClass}>{row.classDisplay || "-"}</Text>
              ) : (
                <Text style={styles.colRole}>{row.role || "-"}</Text>
              )}
              <Text style={styles.colValue}>R$ {row.unitValue}</Text>
              <Text style={styles.colStatus}>{row.purchaseStatusLabel}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function ReportDocument({
  report,
  ownerName,
}: {
  report: PdfTripReport;
  ownerName: string;
}) {
  const statusFilter = report.filters.purchaseStatus
    ? report.statusOptions.find((option) => option.value === report.filters.purchaseStatus)
        ?.label ?? report.filters.purchaseStatus
    : "Todos";

  return (
    <Document title={`passeio-escolar-${report.trip.code}`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.logoTitle}>Estancia e Parque</Text>
            <Text style={styles.logoSubtitle}>Ecologica das Aguas</Text>
            <Text style={styles.headerTitle}>Relatorio do passeio escolar</Text>
            <Text style={styles.headerMeta}>
              {report.trip.code} - {ownerName} - {report.trip.dateLabel} - Status da
              compra: {statusFilter}
            </Text>
          </View>

          <View style={styles.body}>
            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{report.students.length}</Text>
                <Text style={styles.metricLabel}>Alunos</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{report.educators.length}</Text>
                <Text style={styles.metricLabel}>Educadores</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{report.indicators.totalCount}</Text>
                <Text style={styles.metricLabel}>Participantes</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{report.indicators.paidCount}</Text>
                <Text style={styles.metricLabel}>Pagos</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{report.indicators.usedCount}</Text>
                <Text style={styles.metricLabel}>Usados</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>R$ {report.indicators.totalValue}</Text>
                <Text style={styles.metricLabel}>Valor total</Text>
              </View>
            </View>

            <ParticipantTable title="Alunos" rows={report.students} showClass />
            <ParticipantTable
              title="Educadores"
              rows={report.educators}
              showClass={false}
            />
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderOpsTripSchoolReportPdfBuffer(
  report: PdfTripReport,
  ownerName: string,
) {
  return renderToBuffer(<ReportDocument report={report} ownerName={ownerName} />);
}
