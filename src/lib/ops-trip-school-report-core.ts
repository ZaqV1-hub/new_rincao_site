import type { Pool } from "pg";
import { buildSchoolClassDisplay } from "@/lib/school-education";

export type TripParticipantRow = {
  idcompra: number | null;
  idvoucher: number | null;
  numvoucher: string | null;
  tpparticipante: string | null;
  nomealuno: string | null;
  nomeeducador: string | null;
  funcaoeducador: string | null;
  ensino_tipo: string | null;
  ensino_ano: string | null;
  turma_letra: string | null;
  turma: string | null;
  vlunicompra: string | number | null;
  dtcompra: string | null;
  hrcompra: string | null;
  dtpagamento: string | null;
  hrpagamento: string | null;
  stcompra: string | null;
  dtuso: string | null;
  hruso: string | null;
  stusado: string | null;
};

export type TripStatusOptionRow = {
  status: string | null;
};

export type OpsTripSchoolReportParticipant = {
  purchaseId: number;
  voucherId: number;
  voucherNumber: string;
  name: string;
  role: string;
  educationType: string;
  educationYear: string;
  classLetter: string;
  classDisplay: string;
  unitValue: string;
  purchaseDate: string | null;
  purchaseDateLabel: string;
  paymentDate: string | null;
  paymentDateLabel: string;
  used: boolean;
  usedLabel: string;
  usedDate: string | null;
  usedDateLabel: string;
  purchaseStatus: string;
  purchaseStatusLabel: string;
};

export type OpsTripSchoolReportIndicators = {
  paidCount: number;
  unpaidCount: number;
  usedCount: number;
  unusedCount: number;
  paidValue: string;
  unpaidValue: string;
  usedValue: string;
  unusedValue: string;
  totalCount: number;
  totalValue: string;
};

export type OpsTripSchoolReportFilters = {
  purchaseStatus: string;
};

export type OpsTripSchoolReportStatusOption = {
  value: string;
  label: string;
};

export type OpsTripSchoolReportSections = {
  statusOptions: OpsTripSchoolReportStatusOption[];
  indicators: OpsTripSchoolReportIndicators;
  students: OpsTripSchoolReportParticipant[];
  educators: OpsTripSchoolReportParticipant[];
};

type CsvReportLike = {
  trip: {
    code: string;
    dateLabel: string;
  };
  filters: OpsTripSchoolReportFilters;
  indicators: OpsTripSchoolReportIndicators;
  students: OpsTripSchoolReportParticipant[];
  educators: OpsTripSchoolReportParticipant[];
};

const agendaTypeLabels: Record<string, string> = {
  padra: "Padrao",
  promo: "Promocional",
  escol: "Escolar",
  igrej: "Igreja",
  casam: "Casamento",
  melho: "Melhor idade",
  confr: "Confraternizacao",
  ongs: "ONG",
  grmix: "Grupo misto",
};

const agendaStatusLabels: Record<string, string> = {
  abe: "Aberta",
  enc: "Encerrada",
  can: "Cancelada",
  fec: "Fechada",
  lot: "Lotada",
};

const purchaseStatusLabels: Record<string, string> = {
  conc: "Concluida",
  pago: "Pago",
  paid: "Pago",
  pend: "Pendente",
  canc: "Cancelada",
};

export function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizePurchaseStatus(value: unknown) {
  return normalizeText(value).toLowerCase();
}

export function assertPositiveInteger<TError extends Error>(
  value: unknown,
  message: string,
  createError: (message: string) => TError,
) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createError(message);
  }

  return parsed;
}

export function formatAgendaTypeLabel(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return agendaTypeLabels[normalized] ?? (normalized || "-");
}

export function formatAgendaStatusLabel(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return agendaStatusLabels[normalized] ?? (normalized || "-");
}

export function formatActiveStatusLabel(
  value: string | null | undefined,
  activeLabel = "Ativa",
  inactiveLabel = "Inativa",
) {
  return normalizeText(value).toLowerCase() === "ina" ? inactiveLabel : activeLabel;
}

export function formatPurchaseStatusLabel(value: string | null | undefined) {
  const normalized = normalizePurchaseStatus(value);
  return purchaseStatusLabels[normalized] ?? (normalized || "-");
}

export function formatDateLabel(value: string | null | undefined) {
  const normalized = normalizeText(value).slice(0, 10);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return "-";
  }

  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function formatDateTimeLabel(
  date: string | null | undefined,
  time: string | null | undefined,
) {
  const dateLabel = formatDateLabel(date);
  const normalizedTime = normalizeText(time).slice(0, 5);

  if (dateLabel === "-") {
    return "-";
  }

  return normalizedTime ? `${dateLabel} ${normalizedTime}` : dateLabel;
}

export function formatMoney(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric)) {
    return "0.00";
  }

  return numeric.toFixed(2);
}

export function isPaidPurchase(status: string | null | undefined) {
  return ["conc", "pago", "paid"].includes(normalizePurchaseStatus(status));
}

function isUsedVoucher(value: string | null | undefined) {
  const normalized = normalizeText(value).toLowerCase();
  return ["s", "1", "true", "t", "sim"].includes(normalized);
}

function participantSortKey(
  participant: OpsTripSchoolReportParticipant,
  useClass = false,
) {
  const classKey = useClass
    ? participant.classDisplay || participant.classLetter
    : "";
  return `${classKey}\u0000${participant.name}`.toLowerCase();
}

export function mapParticipantRow(
  row: TripParticipantRow,
): OpsTripSchoolReportParticipant {
  const participantType = normalizePurchaseStatus(row.tpparticipante);
  const educationType = normalizeText(row.ensino_tipo);
  const educationYear = normalizeText(row.ensino_ano);
  const classLetter = normalizeText(row.turma_letra) || normalizeText(row.turma);
  const classDisplay =
    buildSchoolClassDisplay(educationType, educationYear, classLetter) || classLetter;
  const used = isUsedVoucher(row.stusado);

  return {
    purchaseId: Number(row.idcompra ?? 0),
    voucherId: Number(row.idvoucher ?? 0),
    voucherNumber: normalizeText(row.numvoucher) || String(row.idvoucher ?? "-"),
    name:
      participantType === "educador"
        ? normalizeText(row.nomeeducador)
        : normalizeText(row.nomealuno),
    role:
      participantType === "educador"
        ? normalizeText(row.funcaoeducador) || "Titular"
        : "",
    educationType,
    educationYear,
    classLetter,
    classDisplay,
    unitValue: formatMoney(row.vlunicompra),
    purchaseDate: normalizeText(row.dtcompra).slice(0, 10) || null,
    purchaseDateLabel: formatDateTimeLabel(row.dtcompra, row.hrcompra),
    paymentDate: normalizeText(row.dtpagamento).slice(0, 10) || null,
    paymentDateLabel: formatDateTimeLabel(row.dtpagamento, row.hrpagamento),
    used,
    usedLabel: used ? "Sim" : "Nao",
    usedDate: normalizeText(row.dtuso).slice(0, 10) || null,
    usedDateLabel: formatDateTimeLabel(row.dtuso, row.hruso),
    purchaseStatus: normalizePurchaseStatus(row.stcompra),
    purchaseStatusLabel: formatPurchaseStatusLabel(row.stcompra),
  };
}

export function splitParticipants(
  participants: OpsTripSchoolReportParticipant[],
  rows: TripParticipantRow[],
) {
  const students = participants
    .filter(
      (_participant, index) =>
        normalizePurchaseStatus(rows[index]?.tpparticipante) !== "educador",
    )
    .sort((left, right) =>
      participantSortKey(left, true).localeCompare(participantSortKey(right, true)),
    );
  const educators = participants
    .filter(
      (_participant, index) =>
        normalizePurchaseStatus(rows[index]?.tpparticipante) === "educador",
    )
    .sort((left, right) =>
      participantSortKey(left).localeCompare(participantSortKey(right)),
    );

  return {
    students,
    educators,
  };
}

export function buildIndicators(
  participants: OpsTripSchoolReportParticipant[],
): OpsTripSchoolReportIndicators {
  let paidCount = 0;
  let unpaidCount = 0;
  let usedCount = 0;
  let unusedCount = 0;
  let paidValue = 0;
  let unpaidValue = 0;
  let usedValue = 0;
  let unusedValue = 0;

  for (const participant of participants) {
    const value = Number(participant.unitValue);

    if (isPaidPurchase(participant.purchaseStatus)) {
      paidCount += 1;
      paidValue += value;
    } else {
      unpaidCount += 1;
      unpaidValue += value;
    }

    if (participant.used) {
      usedCount += 1;
      usedValue += value;
    } else {
      unusedCount += 1;
      unusedValue += value;
    }
  }

  return {
    paidCount,
    unpaidCount,
    usedCount,
    unusedCount,
    paidValue: formatMoney(paidValue),
    unpaidValue: formatMoney(unpaidValue),
    usedValue: formatMoney(usedValue),
    unusedValue: formatMoney(unusedValue),
    totalCount: participants.length,
    totalValue: formatMoney(paidValue + unpaidValue),
  };
}

export function buildStatusOptions(rows: TripStatusOptionRow[]) {
  return [
    { value: "", label: "Todos" },
    ...rows
      .map((row) => normalizePurchaseStatus(row.status))
      .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index)
      .map((value) => ({
        value,
        label: formatPurchaseStatusLabel(value),
      })),
  ];
}

export async function loadOpsTripSchoolReportSections(
  pool: Pick<Pool, "query">,
  input: {
    agendaId: number;
    schoolId: number;
    purchaseStatus: string;
  },
): Promise<OpsTripSchoolReportSections> {
  const statusResult = await pool.query<TripStatusOptionRow>(
    `
      SELECT DISTINCT compra.stcompra AS status
      FROM voucher
      JOIN compra ON compra.idcompra = voucher.idcompra
      WHERE voucher.idagenda = $1
        AND voucher.idescola = $2
        AND compra.stcompra IS NOT NULL
        AND trim(compra.stcompra) <> ''
      ORDER BY compra.stcompra ASC
    `,
    [input.agendaId, input.schoolId],
  );

  const participantParams: Array<string | number> = [
    input.agendaId,
    input.schoolId,
  ];
  let purchaseStatusWhere = "";

  if (input.purchaseStatus) {
    participantParams.push(input.purchaseStatus);
    purchaseStatusWhere = `AND trim(lower(compra.stcompra)) = $${participantParams.length}`;
  }

  const participantsResult = await pool.query<TripParticipantRow>(
    `
      SELECT
        compra.idcompra,
        voucher.idvoucher,
        voucher.numvoucher,
        voucher.tpparticipante,
        voucher.nomealuno,
        voucher.nomeeducador,
        voucher.funcaoeducador,
        voucher.ensino_tipo,
        voucher.ensino_ano,
        voucher.turma_letra,
        voucher.turma,
        COALESCE(voucher.vlunicompra, 0)::text AS vlunicompra,
        compra.dtcompra::text AS dtcompra,
        compra.hrcompra::text AS hrcompra,
        compra.dtpagamento::text AS dtpagamento,
        compra.hrpagamento::text AS hrpagamento,
        compra.stcompra,
        voucher.dtuso::text AS dtuso,
        voucher.hruso::text AS hruso,
        voucher.stusado
      FROM voucher
      JOIN compra ON compra.idcompra = voucher.idcompra
      LEFT JOIN pagpagseguro ON pagpagseguro.idcompra = compra.idcompra
      WHERE voucher.idagenda = $1
        AND voucher.idescola = $2
        ${purchaseStatusWhere}
      ORDER BY compra.idcompra ASC, voucher.idvoucher ASC
    `,
    participantParams,
  );

  const participants = participantsResult.rows.map(mapParticipantRow);
  const { students, educators } = splitParticipants(
    participants,
    participantsResult.rows,
  );

  return {
    statusOptions: buildStatusOptions(statusResult.rows),
    indicators: buildIndicators(participants),
    students,
    educators,
  };
}

export function buildCsvLine(
  values: Array<string | number | null | undefined>,
) {
  return values
    .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
    .join(";");
}

export function formatOpsTripSchoolReportCsv(
  report: CsvReportLike,
  ownerLabel: string,
  ownerName: string,
) {
  const lines: string[] = [];

  lines.push(
    buildCsvLine([
      "Codigo passeio",
      report.trip.code,
      ownerLabel,
      ownerName,
      "Data",
      report.trip.dateLabel,
    ]),
  );
  lines.push(
    buildCsvLine([
      "Status da compra",
      report.filters.purchaseStatus
        ? formatPurchaseStatusLabel(report.filters.purchaseStatus)
        : "Todos",
    ]),
  );
  lines.push("");
  lines.push(
    buildCsvLine([
      "ID Compra",
      "Voucher",
      "Tipo",
      "Nome",
      "Tipo de Ensino",
      "Ano",
      "Turma",
      "Funcao",
      "Valor (R$)",
      "Data da Compra",
      "Data de Pagamento",
      "Usado?",
      "Data de Uso",
      "Status da Compra",
    ]),
  );

  for (const participant of report.students) {
    lines.push(
      buildCsvLine([
        participant.purchaseId,
        participant.voucherNumber,
        "Aluno",
        participant.name,
        participant.educationType,
        participant.educationYear,
        participant.classLetter,
        "",
        participant.unitValue,
        participant.purchaseDateLabel === "-" ? "" : participant.purchaseDateLabel,
        participant.paymentDateLabel === "-" ? "" : participant.paymentDateLabel,
        participant.usedLabel,
        participant.usedDateLabel === "-" ? "" : participant.usedDateLabel,
        participant.purchaseStatusLabel,
      ]),
    );
  }

  for (const participant of report.educators) {
    lines.push(
      buildCsvLine([
        participant.purchaseId,
        participant.voucherNumber,
        "Educador",
        participant.name,
        "",
        "",
        "",
        participant.role,
        participant.unitValue,
        participant.purchaseDateLabel === "-" ? "" : participant.purchaseDateLabel,
        participant.paymentDateLabel === "-" ? "" : participant.paymentDateLabel,
        participant.usedLabel,
        participant.usedDateLabel === "-" ? "" : participant.usedDateLabel,
        participant.purchaseStatusLabel,
      ]),
    );
  }

  lines.push("");
  lines.push(
    buildCsvLine([
      "Totais",
      "Pagos",
      report.indicators.paidCount,
      "Nao pagos",
      report.indicators.unpaidCount,
      "Usados",
      report.indicators.usedCount,
      "Nao usados",
      report.indicators.unusedCount,
      "Valor total (R$)",
      report.indicators.totalValue,
    ]),
  );

  return lines.join("\n");
}
