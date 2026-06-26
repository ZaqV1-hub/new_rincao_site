import path from "node:path";
import {
  Document,
  Image,
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
    backgroundColor: "#f3f7fb",
    color: "#36536b",
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    border: "1 solid #d7e3ee",
    overflow: "hidden",
  },
  header: {
    backgroundColor: "#133d63",
    paddingHorizontal: 24,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  logoWrap: {
    width: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 96,
    height: 96,
    objectFit: "contain",
  },
  headerContent: {
    flex: 1,
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
    color: "#dcecff",
    fontSize: 10,
  },
  body: {
    padding: 20,
    gap: 14,
  },
  sectionTitle: {
    color: "#1f4f7e",
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
    border: "1 solid #d7e3ee",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#f4f8fc",
  },
  metricValue: {
    color: "#133d63",
    fontSize: 14,
    fontWeight: "bold",
  },
  metricLabel: {
    marginTop: 4,
    color: "#5c7690",
    fontSize: 9,
  },
  table: {
    border: "1 solid #d7e3ee",
    borderRadius: 10,
    overflow: "hidden",
  },
  groupCard: {
    border: "1 solid #d7e3ee",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 10,
  },
  groupHeader: {
    backgroundColor: "#e9f1f9",
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: "#1f4f7e",
    fontSize: 10,
    fontWeight: "bold",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#eef5fb",
    color: "#36536b",
    fontWeight: "bold",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderTop: "1 solid #e3edf6",
  },
  colVoucher: { width: "14%" },
  colName: { width: "28%" },
  colClass: { width: "22%" },
  colRole: { width: "16%" },
  colValue: { width: "10%", textAlign: "right" },
  colStatus: { width: "10%" },
  emptyState: {
    color: "#5c7690",
  },
});

const logoPath = path.join(process.cwd(), "public", "brand", "rincao-logo-white.png");

function buildStudentGroups(rows: OpsTripSchoolReportParticipant[]) {
  const groups = new Map<string, OpsTripSchoolReportParticipant[]>();

  for (const row of rows) {
    const key = row.classDisplay || "Sem turma";
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  }

  return Array.from(groups.entries()).map(([label, participants]) => ({
    label,
    participants,
  }));
}

function ParticipantRows({
  rows,
  showClass,
}: {
  rows: OpsTripSchoolReportParticipant[];
  showClass: boolean;
}) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={styles.colVoucher}>Voucher</Text>
        <Text style={styles.colName}>Nome</Text>
        {showClass ? (
          <Text style={styles.colClass}>Turma</Text>
        ) : (
          <Text style={styles.colRole}>Função</Text>
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
  );
}

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
      ) : showClass ? (
        <View>
          {buildStudentGroups(rows).map((group) => (
            <View key={group.label} style={styles.groupCard}>
              <Text style={styles.groupHeader}>
                Turma {group.label} ({group.participants.length})
              </Text>
              <ParticipantRows rows={group.participants} showClass />
            </View>
          ))}
        </View>
      ) : (
        <ParticipantRows rows={rows} showClass={false} />
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
            <View style={styles.logoWrap}>
              <Image alt="" src={logoPath} style={styles.logoImage} />
            </View>
            <View style={styles.headerContent}>
              <Text style={styles.logoTitle}>Rincão</Text>
              <Text style={styles.logoSubtitle}>Painel Administrativo</Text>
              <Text style={styles.headerTitle}>Relatório do passeio escolar</Text>
              <Text style={styles.headerMeta}>
                {report.trip.code} - {ownerName} - {report.trip.dateLabel} - Status da
                compra: {statusFilter}
              </Text>
            </View>
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
