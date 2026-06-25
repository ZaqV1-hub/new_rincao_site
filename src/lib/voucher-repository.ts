import { Buffer } from "node:buffer";
import { getIngressoDbPool } from "@/lib/ingresso-db";
import { buildSchoolDisplay } from "@/lib/school-structure";
import { resolveVoucherTypeLabel } from "@/lib/voucher-type-label";
import type {
  PurchaseType,
  UserVoucher,
  UserVoucherPurchase,
} from "@/lib/voucher-contracts";

type PurchaseRow = {
  idcompra: number;
  tpcompra: PurchaseType;
  dtcompra: string | null;
  vltotcompra: string | null;
  stcompra: string | null;
  status: number | null;
  paymentmethodtype: number | null;
  voucher_count: string;
  unused_voucher_count: string;
};

type VoucherRow = {
  idcompra: number;
  idvoucher: number;
  numvoucher: string | null;
  tpvoucher: string | null;
  vlunicompra: string | null;
  stusado: string | null;
  dtuso: string | null;
  voucherenviado: string | null;
  dtvalidade: string | null;
  dtagenda: string | null;
  tpagenda: string | null;
  idescola: number | null;
  nmescola: string | null;
  nomealuno: string | null;
  nomeeducador: string | null;
  turma: string | null;
  ensino_tipo: string | null;
  ensino_ano: string | null;
  turma_letra: string | null;
  descricao: string | null;
};

export type UserVouchersPage = {
  purchases: UserVoucherPurchase[];
  totalPurchases: number;
};

export type VoucherExportVoucher = {
  id: number;
  number: string | null;
  type: string | null;
  typeLabel: string;
  visitDate: string | null;
  unitValue: string | null;
  agendaType: string | null;
  schoolName: string | null;
  participantName: string | null;
  schoolClassDisplay: string | null;
  description: string | null;
};

export type VoucherExportData = {
  purchase: UserVoucherPurchase;
  vouchers: VoucherExportVoucher[];
  information: string | null;
  isSchool: boolean;
};

export type UserVoucherRescheduleData = {
  purchaseId: number;
  agendaId: number;
  voucher: UserVoucher;
};

type PurchasePageRows = {
  totalPurchases: number;
  purchaseRows: PurchaseRow[];
};

const purchaseTypeLabels: Record<string, string> = {
  ponli: "Compra",
  reser: "Reserva",
  bilhe: "Bilheteria",
};

const purchaseStatusLabels: Record<string, string> = {
  conc: "Pago",
  canc: "Cancelado",
  pend: "Em processamento",
};

const paymentStatusLabels: Record<number, string> = {
  1: "Aguardando pagamento",
  2: "Em analise",
  3: "Paga",
  4: "Disponivel",
  5: "Em disputa",
  6: "Devolvida",
  7: "Cancelada",
  8: "Chargeback debitado",
  9: "Em contestacao",
};

function encodeLegacyId(id: number) {
  return Buffer.from(String(id), "utf8").toString("base64");
}

function labelFromMap(map: Record<string, string>, key: string | null) {
  return key ? map[key] ?? key : "";
}

function normalizeDate(value: string | null) {
  return value ? value.slice(0, 10) : null;
}

function daysBetween(startDate: string | null, endDate: Date) {
  if (!startDate) {
    return Number.POSITIVE_INFINITY;
  }

  const start = new Date(`${startDate.slice(0, 10)}T00:00:00.000Z`);
  const end = new Date(
    Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()),
  );

  return Math.floor((end.getTime() - start.getTime()) / 86400000);
}

function daysBetweenDates(startDate: Date, endDate: string | null) {
  if (!endDate) {
    return Number.POSITIVE_INFINITY;
  }

  const start = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()),
  );
  const end = new Date(`${endDate.slice(0, 10)}T00:00:00.000Z`);

  return Math.floor((end.getTime() - start.getTime()) / 86400000);
}

function mapVoucher(row: VoucherRow, purchase: PurchaseRow, today: Date): UserVoucher {
  const purchaseAgeDays = daysBetween(purchase.dtcompra, today);
  const visitDiffDays = daysBetweenDates(today, row.dtagenda);
  const used = row.stusado === "s";
  const expiredForGeneration = purchaseAgeDays > 90;
  const canSelectForVoucher = purchase.stcompra === "conc" && !used && !expiredForGeneration;

  return {
    id: row.idvoucher,
    type: row.tpvoucher,
    typeLabel: resolveVoucherTypeLabel({
      description: row.descricao,
      type: row.tpvoucher,
    }),
    number: row.numvoucher,
    visitDate: normalizeDate(row.dtagenda),
    useDate: normalizeDate(row.dtuso),
    unitValue: row.vlunicompra,
    used,
    useStatus: row.stusado,
    agendaType: row.tpagenda,
    schoolName: row.nmescola,
    participantName: row.nomealuno || row.nomeeducador || null,
    sent: row.voucherenviado?.trim() === "s",
    validUntil: normalizeDate(row.dtvalidade),
    canSelectForVoucher,
    canReschedule:
      row.tpagenda === "padra" &&
      !used &&
      !expiredForGeneration &&
      row.tpvoucher !== "escol" &&
      visitDiffDays <= 0,
    expiredForGeneration,
  };
}

function mapVoucherExport(row: VoucherRow): VoucherExportVoucher {
  return {
    id: row.idvoucher,
    number: row.numvoucher,
    type: row.tpvoucher,
    typeLabel: resolveVoucherTypeLabel({
      description: row.descricao,
      type: row.tpvoucher,
    }),
    visitDate: normalizeDate(row.dtagenda),
    unitValue: row.vlunicompra,
    agendaType: row.tpagenda,
    schoolName: row.nmescola,
    participantName: row.nomealuno || row.nomeeducador || null,
    schoolClassDisplay:
      buildSchoolDisplay(
        row.ensino_tipo,
        row.ensino_ano,
        row.turma_letra,
        row.turma,
      ) || null,
    description: row.descricao,
  };
}

function mapPurchase(
  row: PurchaseRow,
  vouchers: UserVoucher[],
  today: Date,
): UserVoucherPurchase {
  const purchaseAgeDays = daysBetween(row.dtcompra, today);
  const unusedVoucherCount = Number(row.unused_voucher_count);
  const paymentStatus = row.status;

  return {
    id: row.idcompra,
    legacyEncodedId: encodeLegacyId(row.idcompra),
    type: row.tpcompra,
    typeLabel: labelFromMap(purchaseTypeLabels, row.tpcompra),
    purchaseDate: normalizeDate(row.dtcompra),
    totalValue: row.vltotcompra,
    status: row.stcompra,
    statusLabel: labelFromMap(purchaseStatusLabels, row.stcompra),
    payment: {
      provider: row.tpcompra === "ponli" ? "pagseguro" : "bilheteria",
      status: paymentStatus,
      statusLabel:
        row.tpcompra === "reser"
          ? "Bilheteria"
          : paymentStatus
            ? paymentStatusLabels[paymentStatus] ?? String(paymentStatus)
            : "Aguardando",
      methodType: row.paymentmethodtype,
    },
    unusedVoucherCount,
    voucherCount: Number(row.voucher_count),
    canGenerateVoucher:
      row.tpcompra === "ponli" &&
      row.stcompra === "conc" &&
      unusedVoucherCount > 0 &&
      purchaseAgeDays <= 90,
    canCancelReservation:
      row.tpcompra === "reser" &&
      row.stcompra !== "canc" &&
      unusedVoucherCount > 0,
    vouchers,
  };
}

async function getPurchasePageRows(
  cpf: string,
  {
    limit,
    offset,
    purchaseId,
  }: {
    limit?: number;
    offset?: number;
    purchaseId?: number;
  },
): Promise<PurchasePageRows> {
  const pool = getIngressoDbPool();
  const totalResult = await pool.query<{ total: string }>(
    `
      SELECT COUNT(*)::text AS total
      FROM compra
      WHERE cpf = $1
        AND tpcompra IN ('ponli', 'reser')
    `,
    [cpf],
  );
  const params: Array<number | string> = [cpf];
  const filters = [
    "compra.cpf = $1",
    "compra.tpcompra IN ('ponli', 'reser')",
  ];

  if (purchaseId) {
    params.push(purchaseId);
    filters.push(`compra.idcompra = $${params.length}`);
  }

  let paginationClause = "";

  if (typeof limit === "number" && typeof offset === "number") {
    params.push(limit, offset);
    paginationClause = `LIMIT $${params.length - 1} OFFSET $${params.length}`;
  }

  const purchaseResult = await pool.query<PurchaseRow>(
    `
      SELECT
        compra.idcompra,
        compra.tpcompra,
        to_char(compra.dtcompra, 'YYYY-MM-DD') AS dtcompra,
        compra.vltotcompra::text AS vltotcompra,
        compra.stcompra,
        pagpagseguro.status,
        pagpagseguro.paymentmethodtype,
        COUNT(voucher.idvoucher)::text AS voucher_count,
        COUNT(voucher.idvoucher) FILTER (WHERE voucher.stusado = 'n')::text AS unused_voucher_count
      FROM compra
      LEFT JOIN LATERAL (
        SELECT status, paymentmethodtype
        FROM pagpagseguro
        WHERE pagpagseguro.idcompra = compra.idcompra
        ORDER BY pagpagseguro.date DESC NULLS LAST
        LIMIT 1
      ) pagpagseguro ON true
      LEFT JOIN voucher ON voucher.idcompra = compra.idcompra
      WHERE ${filters.join("\n        AND ")}
      GROUP BY
        compra.idcompra,
        compra.tpcompra,
        compra.dtcompra,
        compra.vltotcompra,
        compra.stcompra,
        pagpagseguro.status,
        pagpagseguro.paymentmethodtype
      ORDER BY compra.idcompra DESC
      ${paginationClause}
    `,
    params,
  );

  return {
    totalPurchases: Number(totalResult.rows[0]?.total ?? 0),
    purchaseRows: purchaseResult.rows,
  };
}

async function getVouchersByPurchaseIds(purchaseIds: number[]) {
  if (purchaseIds.length === 0) {
    return new Map<number, VoucherRow[]>();
  }

  const pool = getIngressoDbPool();
  const voucherResult = await pool.query<VoucherRow>(
    `
      SELECT
        voucher.idcompra,
        voucher.idvoucher,
        voucher.numvoucher,
        voucher.tpvoucher,
        voucher.vlunicompra::text AS vlunicompra,
        voucher.stusado,
        to_char(voucher.dtuso, 'YYYY-MM-DD') AS dtuso,
        voucher.voucherenviado,
        to_char(voucher.dtvalidade, 'YYYY-MM-DD') AS dtvalidade,
        to_char(agenda.dtagenda, 'YYYY-MM-DD') AS dtagenda,
        agenda.tpagenda,
        voucher.idescola,
        clientes.nome AS nmescola,
        voucher.nomealuno,
        voucher.nomeeducador,
        voucher.turma,
        voucher.ensino_tipo,
        voucher.ensino_ano,
        voucher.turma_letra,
        voucher.descricao AS descricao
      FROM voucher
      JOIN agenda ON agenda.idagenda = voucher.idagenda
      LEFT JOIN clientes ON clientes.idcliente = voucher.idescola
      WHERE voucher.idcompra = ANY($1::int[])
      ORDER BY voucher.idcompra DESC, voucher.idvoucher DESC
    `,
    [purchaseIds],
  );
  const vouchersByPurchaseId = new Map<number, VoucherRow[]>();

  for (const voucher of voucherResult.rows) {
    const vouchers = vouchersByPurchaseId.get(voucher.idcompra) ?? [];
    vouchers.push(voucher);
    vouchersByPurchaseId.set(voucher.idcompra, vouchers);
  }

  return vouchersByPurchaseId;
}

function mapPurchaseRows(
  purchaseRows: PurchaseRow[],
  vouchersByPurchaseId: Map<number, VoucherRow[]>,
) {
  const today = new Date();

  return purchaseRows.map((purchase) =>
    mapPurchase(
      purchase,
      (vouchersByPurchaseId.get(purchase.idcompra) ?? []).map((voucher) =>
        mapVoucher(voucher, purchase, today),
      ),
      today,
    ),
  );
}

export async function getUserVouchersPage(
  cpf: string,
  limit: number,
  offset: number,
): Promise<UserVouchersPage> {
  const page = await getPurchasePageRows(cpf, { limit, offset });
  const purchaseIds = page.purchaseRows.map((row) => row.idcompra);

  if (purchaseIds.length === 0) {
    return {
      totalPurchases: page.totalPurchases,
      purchases: [],
    };
  }

  const vouchersByPurchaseId = await getVouchersByPurchaseIds(purchaseIds);

  return {
    totalPurchases: page.totalPurchases,
    purchases: mapPurchaseRows(page.purchaseRows, vouchersByPurchaseId),
  };
}

export async function getUserVoucherPurchaseById(cpf: string, purchaseId: number) {
  const page = await getPurchasePageRows(cpf, { purchaseId });
  const purchase = page.purchaseRows[0];

  if (!purchase) {
    return null;
  }

  const vouchersByPurchaseId = await getVouchersByPurchaseIds([purchaseId]);

  return mapPurchaseRows([purchase], vouchersByPurchaseId)[0] ?? null;
}

async function getInformationForVoucherExport(voucher: VoucherRow) {
  const pool = getIngressoDbPool();

  if (voucher.tpagenda === "escol" && voucher.idescola) {
    const result = await pool.query<{ texto: string | null }>(
      `
        SELECT informacao.texto
        FROM escola
        LEFT JOIN informacao ON informacao.idinformacao = escola.idinformacao
        WHERE escola.idescola = $1
        LIMIT 1
      `,
      [voucher.idescola],
    );

    return result.rows[0]?.texto ?? null;
  }

  if (!voucher.dtagenda) {
    return null;
  }

  const result = await pool.query<{ texto: string | null }>(
    `
      SELECT informacao.texto
      FROM informacao
      LEFT JOIN agenda ON agenda.idinformacao = informacao.idinformacao
      WHERE agenda.dtagenda = $1
      ORDER BY informacao.idinformacao DESC
      LIMIT 1
    `,
    [voucher.dtagenda],
  );

  return result.rows[0]?.texto ?? null;
}

export async function getUserVoucherExportData(
  cpf: string,
  purchaseId: number,
  selectedVoucherIds: number[],
): Promise<VoucherExportData | null> {
  const page = await getPurchasePageRows(cpf, { purchaseId });
  const purchaseRow = page.purchaseRows[0];

  if (!purchaseRow) {
    return null;
  }

  const vouchersByPurchaseId = await getVouchersByPurchaseIds([purchaseId]);
  const voucherRows = vouchersByPurchaseId.get(purchaseId) ?? [];
  const purchase = mapPurchaseRows([purchaseRow], vouchersByPurchaseId)[0] ?? null;

  if (!purchase) {
    return null;
  }

  const eligibleVoucherIds = new Set(
    purchase.vouchers
      .filter((voucher) => voucher.canSelectForVoucher)
      .map((voucher) => voucher.id),
  );
  const vouchersToExport = (
    selectedVoucherIds.length > 0
      ? voucherRows.filter(
          (voucher) =>
            selectedVoucherIds.includes(voucher.idvoucher) &&
            eligibleVoucherIds.has(voucher.idvoucher),
        )
      : voucherRows.filter((voucher) => eligibleVoucherIds.has(voucher.idvoucher))
  ).map(mapVoucherExport);
  const firstVoucher = voucherRows.find((voucher) =>
    vouchersToExport.some((selectedVoucher) => selectedVoucher.id === voucher.idvoucher),
  );

  return {
    purchase,
    vouchers: vouchersToExport,
    information: firstVoucher
      ? await getInformationForVoucherExport(firstVoucher)
      : null,
    isSchool: firstVoucher?.tpagenda === "escol",
  };
}

export async function cancelReservationPurchase(cpf: string, purchaseId: number) {
  const pool = getIngressoDbPool();
  const result = await pool.query<{ idcompra: number }>(
    `
      UPDATE compra
      SET stcompra = 'canc'
      WHERE idcompra = $1
        AND cpf = $2
        AND tpcompra = 'reser'
        AND stcompra <> 'canc'
      RETURNING idcompra
    `,
    [purchaseId, cpf],
  );

  return result.rows[0]?.idcompra ?? null;
}

export async function getUserVoucherRescheduleData(
  cpf: string,
  voucherId: number,
): Promise<UserVoucherRescheduleData | null> {
  const pool = getIngressoDbPool();
  const result = await pool.query<
    VoucherRow &
      Pick<PurchaseRow, "tpcompra" | "dtcompra" | "stcompra"> & {
        cpf: string;
        idagenda: number;
      }
  >(
    `
      SELECT
        compra.cpf,
        compra.tpcompra,
        to_char(compra.dtcompra, 'YYYY-MM-DD') AS dtcompra,
        compra.stcompra,
        voucher.idcompra,
        voucher.idvoucher,
        voucher.numvoucher,
        voucher.tpvoucher,
        voucher.vlunicompra::text AS vlunicompra,
        voucher.stusado,
        to_char(voucher.dtuso, 'YYYY-MM-DD') AS dtuso,
        voucher.voucherenviado,
        to_char(voucher.dtvalidade, 'YYYY-MM-DD') AS dtvalidade,
        to_char(agenda.dtagenda, 'YYYY-MM-DD') AS dtagenda,
        agenda.tpagenda,
        voucher.idescola,
        clientes.nome AS nmescola,
        voucher.nomealuno,
        voucher.nomeeducador,
        voucher.turma,
        voucher.ensino_tipo,
        voucher.ensino_ano,
        voucher.turma_letra,
        voucher.descricao AS descricao,
        agenda.idagenda
      FROM voucher
      JOIN compra ON compra.idcompra = voucher.idcompra
      JOIN agenda ON agenda.idagenda = voucher.idagenda
      LEFT JOIN clientes ON clientes.idcliente = voucher.idescola
      WHERE voucher.idvoucher = $1
        AND compra.cpf = $2
      LIMIT 1
    `,
    [voucherId, cpf],
  );
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const purchaseRow: PurchaseRow = {
    idcompra: row.idcompra,
    tpcompra: row.tpcompra,
    dtcompra: row.dtcompra,
    vltotcompra: null,
    stcompra: row.stcompra,
    status: null,
    paymentmethodtype: null,
    voucher_count: "1",
    unused_voucher_count: row.stusado === "n" ? "1" : "0",
  };

  return {
    purchaseId: row.idcompra,
    agendaId: Number(row.idagenda),
    voucher: mapVoucher(row, purchaseRow, new Date()),
  };
}

export async function rescheduleUserVoucher(
  cpf: string,
  voucherId: number,
  agendaId: number,
) {
  const pool = getIngressoDbPool();
  const result = await pool.query<{ idvoucher: number }>(
    `
      UPDATE voucher
      SET idagenda = $1
      FROM compra
      WHERE compra.idcompra = voucher.idcompra
        AND voucher.idvoucher = $2
        AND compra.cpf = $3
        AND voucher.stusado = 'n'
      RETURNING voucher.idvoucher
    `,
    [agendaId, voucherId, cpf],
  );

  return result.rows[0]?.idvoucher ?? null;
}
