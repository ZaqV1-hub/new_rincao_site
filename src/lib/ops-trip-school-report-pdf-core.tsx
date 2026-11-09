import path from "node:path";
import type { ReactNode } from "react";
import { Document, Font, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import {
  buildIndicators,
  isPaidPurchase,
  normalizePurchaseStatus,
  type OpsTripSchoolReportParticipant,
} from "@/lib/ops-trip-school-report-core";
import { styles, palette } from "@/lib/ops-trip-school-report-pdf-styles";
import { getSchoolEducationStructure, normalizeSchoolEducationType } from "@/lib/school-education";

export type TripReportAudience = "school" | "internal";

type TripReport = {
  trip: { code: string; dateLabel: string };
  students: OpsTripSchoolReportParticipant[];
  educators: OpsTripSchoolReportParticipant[];
};

const educationTypes = getSchoolEducationStructure().types;
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const classOrder = new Intl.Collator("pt-BR", { numeric: true });
const statusLabels = new Map([["conc", "Concluída"], ["pend", "Pendente"], ["canc", "Cancelada"]]);
const nameParticles = new Set(["da", "das", "de", "do", "dos", "e"]);

function educationLabel(value: string) {
  return value
    .replace(/educacao infantil/gi, "Educação Infantil")
    .replace(/ensino medio/gi, "Ensino Médio")
    .replace(/(\d+)o\s+ano/gi, "$1º ano");
}

function formatStudentName(name: string) {
  return name.toLocaleLowerCase("pt-BR").replace(/\p{L}[\p{L}\p{M}]*/gu, (word, offset: number) =>
    offset > 0 && nameParticles.has(word) ? word : word[0].toLocaleUpperCase("pt-BR") + word.slice(1),
  );
}

function statusCounts(rows: OpsTripSchoolReportParticipant[]) {
  return {
    ...buildIndicators(rows),
    pending: rows.filter((row) => normalizePurchaseStatus(row.purchaseStatus) === "pend").length,
    cancelled: rows.filter((row) => normalizePurchaseStatus(row.purchaseStatus) === "canc").length,
  };
}

function standardPrice(rows: OpsTripSchoolReportParticipant[]) {
  const frequencies = new Map<number, number>();
  for (const row of rows) {
    const value = Number(row.unitValue);
    if (value > 0 && isPaidPurchase(row.purchaseStatus)) {
      frequencies.set(value, (frequencies.get(value) ?? 0) + 1);
    }
  }
  const [mostCommon, second] = [...frequencies].sort((left, right) => right[1] - left[1]);
  return mostCommon && mostCommon[1] !== second?.[1] ? mostCommon[0] : undefined;
}

function groupClasses(students: OpsTripSchoolReportParticipant[]) {
  const segments = new Map<string, Map<string, OpsTripSchoolReportParticipant[]>>();
  for (const student of students) {
    const typeId = normalizeSchoolEducationType(student.educationType);
    const type = educationTypes.find(({ id }) => id === typeId);
    const segment = educationLabel(type?.label ?? (student.educationType || "Sem segmento"));
    const classLabel = educationLabel(student.classDisplay || student.classLetter || "Sem turma");
    const prefix = `${segment} - `;
    const label = classLabel.startsWith(prefix) ? classLabel.slice(prefix.length) : classLabel;
    const classes = segments.get(segment) ?? new Map<string, OpsTripSchoolReportParticipant[]>();
    const rows = classes.get(label) ?? [];
    rows.push(student);
    classes.set(label, rows);
    segments.set(segment, classes);
  }

  const order = [...educationTypes.map((type) => educationLabel(type.label)), ...segments.keys()];
  return [...segments].sort(([left], [right]) => order.indexOf(left) - order.indexOf(right))
    .map(([segment, classes]) => ({
      segment,
      classes: [...classes].sort(([left], [right]) => classOrder.compare(left, right))
        .map(([label, rows]) => ({ label, rows, counts: statusCounts(rows) })),
    }));
}

Font.register({
  family: "Trip Rubik",
  fonts: [300, 400, 500, 700].map((fontWeight) => ({
    src: path.join(process.cwd(), "public", "fonts", `rubik-${fontWeight}.ttf`),
    fontWeight,
  })),
});

type Metric = {
  label: string;
  value: string | number;
  note: string;
  color: string;
};

function Totals({ counts, date, internal, fixed = false }: {
  counts: ReturnType<typeof statusCounts>;
  date: string;
  internal: boolean;
  fixed?: boolean;
}) {
  const paid: Metric = {
    label: "Valor pago", value: currency.format(Number(counts.paidValue)),
    note: "Compras concluídas", color: palette.blue,
  };
  const metrics: Metric[] = internal ? [
    { label: "Concluídas", value: counts.paidCount, note: "Alunos confirmados", color: palette.navy },
    { label: "Pendentes", value: counts.pending, note: "Aguardando pagamento", color: palette.amber },
    { label: "Canceladas", value: counts.cancelled, note: "Fora do valor pago", color: palette.coral },
    paid,
  ] : [
    { label: "Alunos confirmados", value: counts.paidCount, note: "Compras concluídas", color: palette.navy },
    paid,
    { label: "Data do passeio", value: date, note: "Clube Rincão", color: palette.amber },
  ];

  return (
    <View style={styles.metrics} fixed={fixed} wrap={false}>
      {metrics.map(({ label, value, note, color }) => (
        <View key={label} style={[styles.metric, { borderTopColor: color }]}>
          <Text style={styles.metricLabel}>{label}</Text>
          <Text style={color === palette.blue ? [styles.metricValue, styles.moneyMetric] : styles.metricValue}>{value}</Text>
          <Text style={styles.note}>{note}</Text>
        </View>
      ))}
    </View>
  );
}

function CardHeading({ title, note, fixed = false }: { title: string; note: string; fixed?: boolean }) {
  return (
    <View style={styles.cardHeading} minPresenceAhead={24} fixed={fixed} wrap={false}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={[styles.note, styles.cardNote]}>{note}</Text>
    </View>
  );
}

function SegmentSummary({ segment, classes, internal }: ReturnType<typeof groupClasses>[number] & { internal: boolean }) {
  return (
    <View style={[styles.card, styles.segment]}>
      <CardHeading title={segment} note={`${classes.length} turma(s)`} fixed />
      <View style={[styles.row, styles.tableHead, styles.tableLabel]} fixed wrap={false}>
        <Text style={styles.summaryClass}>TURMA</Text>
        <Text style={styles.summaryCount}>{internal ? "CONCL." : "ALUNOS"}</Text>
        {internal ? <Text style={styles.summaryCount}>PEND.</Text> : null}
        {internal ? <Text style={styles.summaryCount}>CANC.</Text> : null}
        <Text style={styles.summaryMoney}>VALOR PAGO</Text>
      </View>
      {classes.map(({ label, counts }) => (
        <View key={label} style={[styles.row, styles.bodyRow, styles.summaryRow]} wrap={false}>
          <Text style={styles.summaryClass}>{label}</Text>
          <Text style={[styles.summaryCount, styles.bold]}>{counts.paidCount}</Text>
          {internal ? <Text style={styles.summaryCount}>{counts.pending}</Text> : null}
          {internal ? <Text style={styles.summaryCount}>{counts.cancelled}</Text> : null}
          <Text style={styles.summaryMoney}>{currency.format(Number(counts.paidValue))}</Text>
        </View>
      ))}
    </View>
  );
}

const pillStyles = new Map([
  ["conc", styles.paid], ["pend", styles.pending], ["canc", styles.cancelledPill],
]);

function ParticipantTable({ rows, internal, regularPrice, educatorsOnly = false }: {
  rows: OpsTripSchoolReportParticipant[];
  internal: boolean;
  regularPrice?: number;
  educatorsOnly?: boolean;
}) {
  return (
    <View style={styles.card}>
      <CardHeading
        title={educatorsOnly ? "Educadores" : "Alunos da turma"}
        note={internal ? "Registros de compra e situação do pagamento." : "Marque a presença no dia do passeio."}
        fixed
      />
      <View style={[styles.row, styles.tableHead, styles.tableLabel]} fixed wrap={false}>
        <Text style={styles.number}>#</Text>
        <Text style={styles.purchaseId}>ID DA COMPRA</Text>
        <Text style={styles.voucher}>VOUCHER</Text>
        <Text style={styles.studentName}>{educatorsOnly ? "EDUCADOR" : "NOME DO ALUNO"}</Text>
        <Text style={styles.value}>VALOR</Text>
        <Text style={styles.statusLabel}>{internal ? "STATUS" : "PRESENÇA"}</Text>
      </View>
      {rows.map((row, index) => {
        const status = normalizePurchaseStatus(row.purchaseStatus);
        const cancelled = status === "canc";
        const value = Number(row.unitValue);
        const unusual = !educatorsOnly && regularPrice !== undefined && value !== regularPrice;
        const name = formatStudentName(row.name) + (educatorsOnly && row.role ? ` · ${row.role}` : "");
        const strike = cancelled ? [styles.struck] : [];

        return (
          <View key={row.voucherId} wrap={false} style={[
            styles.row, styles.bodyRow,
            ...(rows.length >= 20 ? [styles.denseRow] : []),
            ...(cancelled ? [styles.cancelled] : []),
          ]}>
            <Text style={[styles.number, styles.note, ...strike]}>{String(index + 1).padStart(2, "0")}</Text>
            <Text style={[styles.purchaseId, styles.bold, ...strike]}>{row.purchaseId || "–"}</Text>
            <Text style={[styles.voucher, styles.bold, ...strike]}>{row.voucherNumber}</Text>
            <Text style={[styles.studentName, ...strike]}>{name}</Text>
            <Text style={[styles.value, ...strike]}>
              <Text style={unusual ? styles.unusual : undefined}>{currency.format(value)}</Text>
            </Text>
            <View style={styles.status}>
              {internal ? (
                <Text style={[styles.pill, pillStyles.get(status) ?? styles.unknown]}>
                  {statusLabels.get(status) ?? row.purchaseStatusLabel}
                </Text>
              ) : <View style={styles.presence} />}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ReportDocument({ report, ownerName, audience }: {
  report: TripReport;
  ownerName: string;
  audience: TripReportAudience;
}) {
  const internal = audience === "internal";
  const students = internal ? report.students : report.students.filter((row) => isPaidPurchase(row.purchaseStatus));
  const educators = internal ? report.educators : report.educators.filter((row) => isPaidPurchase(row.purchaseStatus));
  const segments = groupClasses(students);
  const counts = statusCounts(students);
  const regularPrice = internal ? standardPrice(students) : undefined;
  const { code, dateLabel: date } = report.trip;
  const generated = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const classCount = segments.reduce((total, segment) => total + segment.classes.length, 0);
  const columns: [typeof segments, typeof segments] = [[], []];
  const columnWeights = [0, 0];
  for (const segment of [...segments].sort((left, right) => right.classes.length - left.classes.length)) {
    const column = columnWeights[0] <= columnWeights[1] ? 0 : 1;
    columns[column].push(segment);
    columnWeights[column] += segment.classes.length + 3;
  }

  function sheet(title: string, subtitle: string, body: ReactNode, details: string, sign = false, fixed = false) {
    return (
      <Page key={`${title}/${subtitle}`} size="A4" style={sign ? [styles.page, styles.signedPage] : styles.page}>
        <View style={styles.header} fixed={fixed} wrap={false}>
          <View style={styles.headerText}>
            <Text style={styles.brand}>CLUBE E PARK RINCÃO</Text>
            <Text style={styles.title}>Passeio escolar</Text>
            <Text style={styles.subtitle}>{title}</Text>
            <Text style={styles.meta}>{subtitle}</Text>
          </View>
          <View style={styles.tripCode}>
            <Text style={styles.codeLabel}>CÓDIGO DO PASSEIO</Text>
            <Text style={styles.code}>{code}</Text>
            <Text style={styles.codeMeta}>Passeio em <Text style={styles.bold}>{date}</Text></Text>
            <Text style={styles.codeMeta}>Gerado em {generated}</Text>
          </View>
        </View>
        {body}
        <View style={styles.bottom} fixed>
          {sign ? (
            <View style={styles.signatures}>
              <Text style={[styles.signature, styles.note]}>Professor(a) responsável</Text>
              <Text style={[styles.signature, styles.note]}>Assinatura</Text>
            </View>
          ) : null}
          <View style={[styles.footer, styles.footerBorder]}>
            <Text style={styles.note}>{internal ? "Documento interno · Clube e Park Rincão" : "Documento para uso da escola"}</Text>
            <Text style={[styles.note, styles.footerDetails]}>{code} · {details}</Text>
          </View>
        </View>
      </Page>
    );
  }

  return (
    <Document title={`Passeio escolar ${code}`} language="pt-BR">
      {sheet("Resumo por turma", `${ownerName} · ${classCount} turma(s) · ${counts.totalCount} aluno(s)`, (
        <>
          <Totals counts={counts} date={date} internal={internal} />
          {classCount ? (
            <View style={styles.columns}>
              {columns.filter((column) => column.length).map((column) => (
                <View key={column[0].segment} style={styles.column}>
                  {column.map((segment) => <SegmentSummary key={segment.segment} {...segment} internal={internal} />)}
                </View>
              ))}
            </View>
          ) : <Text style={styles.note}>Nenhum aluno neste relatório.</Text>}
        </>
      ), `Resumo · ${counts.totalCount} aluno(s)`)}
      {segments.flatMap(({ segment, classes }) => classes.map(({ label, rows, counts }) =>
        sheet(label, `${segment} · ${ownerName}`, (
          <>
            <Totals counts={counts} date={date} internal={internal} fixed />
            <ParticipantTable rows={rows} internal={internal} regularPrice={regularPrice} />
          </>
        ), `${label} · ${rows.length} aluno(s)`, !internal, true),
      ))}
      {educators.length ? sheet("Educadores", ownerName,
        <ParticipantTable rows={educators} internal={internal} educatorsOnly />,
        `${educators.length} educador(es)`, false, true,
      ) : null}
    </Document>
  );
}

export async function renderOpsTripSchoolReportPdfBuffer(
  report: TripReport,
  ownerName: string,
  audience: TripReportAudience,
) {
  return renderToBuffer(<ReportDocument report={report} ownerName={ownerName} audience={audience} />);
}
