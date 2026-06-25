import { getIngressoDbPool } from "@/lib/ingresso-db";
import {
  formatPainelBilheteriaCpf,
  formatPainelBilheteriaDate,
  formatPainelBilheteriaMoney,
} from "@/lib/painel-bilheteria-format";

type CustomerRow = {
  cpf: string;
  nmusuario: string | null;
  rg: string | null;
};

type CustomerPurchaseRow = {
  idcompra: number;
  dtcompra: string | null;
  cpf: string | null;
  tpcompra: string | null;
  stcompra: string | null;
  formapag: string | null;
  total_venda: string | null;
};

type CustomerVoucherRow = {
  idcompra: number;
  idvoucher: number;
  numvoucher: string | null;
  tpvoucher: string | null;
  descricao: string | null;
  stusado: string | null;
  agenda_data: string | null;
  vlunicompra: string | null;
};

type TripVoucherRow = {
  codescoladata: string | null;
  nmescola: string | null;
  dtagenda: string | null;
  status: string | null;
  idescola: number | null;
  idagenda: number | null;
  idcompra: number | null;
  idvoucher: number;
  numvoucher: string | null;
  tpvoucher: string | null;
  descricao: string | null;
  stusado: string | null;
  nomealuno: string | null;
  turma: string | null;
  periodo: string | null;
  tpcompra: string | null;
};

type TicketLookupRow = {
  idvoucher: number;
  idcompra: number | null;
  dtcompra: string | null;
  dtuso: string | null;
};

export type PainelBilheteriaLookupVoucher = {
  voucherId: number;
  voucherNumber: string | null;
  voucherTypeCode: string | null;
  statusCode: string | null;
  voucherTypeLabel: string;
  statusLabel: string;
  visitDate: string | null;
  unitValue: string;
};

export type PainelBilheteriaTicketLookupResult = {
  lookup: string;
  voucherId: number;
  purchaseId: number | null;
  purchaseDate: string | null;
  usedDate: string | null;
  used: boolean;
};

export type PainelBilheteriaCustomerLookupPurchase = {
  purchaseId: number;
  purchaseDate: string | null;
  cpf: string | null;
  cpfLabel: string;
  purchaseTypeCode: string | null;
  statusCode: string | null;
  purchaseTypeLabel: string;
  statusLabel: string;
  paymentLabel: string;
  totalValue: string;
  vouchers: PainelBilheteriaLookupVoucher[];
};

export type PainelBilheteriaCustomerLookupResult = {
  lookup: string;
  documentKind: "cpf" | "rg";
  customer: {
    cpf: string | null;
    cpfLabel: string;
    name: string | null;
    rg: string | null;
  } | null;
  purchases: PainelBilheteriaCustomerLookupPurchase[];
};

export type PainelBilheteriaTripLookupItem = {
  voucherId: number;
  purchaseId: number | null;
  voucherNumber: string | null;
  voucherTypeCode: string | null;
  statusCode: string | null;
  voucherTypeLabel: string;
  statusLabel: string;
  studentName: string | null;
  className: string | null;
  periodName: string | null;
  purchaseTypeCode: string | null;
  purchaseTypeLabel: string;
};

export type PainelBilheteriaTripLookupResult = {
  lookup: string;
  schoolId: number | null;
  agendaId: number | null;
  schoolName: string | null;
  visitDate: string | null;
  statusLabel: string;
  items: PainelBilheteriaTripLookupItem[];
};

export class PainelBilheteriaWorkstationError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "PainelBilheteriaWorkstationError";
    this.code = code;
    this.status = status;
  }
}

const purchaseTypeLabels: Record<string, string> = {
  bilhe: "Bilheteria",
  reser: "Reserva",
  ponli: "Pagamento Online",
};

const purchaseStatusLabels: Record<string, string> = {
  pend: "Em processamento",
  conc: "Concluída",
  canc: "Cancelada",
};

const paymentMethodLabels: Record<string, string> = {
  dinhe: "Dinheiro",
  debit: "Débito",
  credi: "Crédito",
  chequ: "Cheque",
  tranb: "Trans. bancária",
  corte: "Cortesia",
  pix: "Pix",
  pgseg: "Pagamento Online",
};

const voucherTypeLabels: Record<string, string> = {
  norma: "Passaporte",
  infan: "Passaporte Infantil",
  isent: "Isento",
  corte: "Cortesia",
  escol: "Escola",
};

const voucherStatusLabels: Record<string, string> = {
  n: "Não usado",
  s: "Usado",
  inv: "Invalidado",
};

const tripStatusLabels: Record<string, string> = {
  ati: "Ativo",
  can: "Cancelado",
  pen: "Pendente",
};

function normalizeDocument(value: string) {
  return value.replace(/[.\-\/\s]+/g, "").trim();
}

function formatPurchaseTypeLabel(value: string | null | undefined) {
  const key = String(value ?? "").trim().toLowerCase();
  return purchaseTypeLabels[key] ?? (key || "-");
}

function formatPurchaseStatusLabel(value: string | null | undefined) {
  const key = String(value ?? "").trim().toLowerCase();
  return purchaseStatusLabels[key] ?? (key || "-");
}

function formatPaymentLabel(value: string | null | undefined) {
  const key = String(value ?? "").trim().toLowerCase();
  return paymentMethodLabels[key] ?? (key || "-");
}

function formatVoucherTypeLabel(value: string | null | undefined) {
  const key = String(value ?? "").trim().toLowerCase();
  return voucherTypeLabels[key] ?? (key || "-");
}

function resolveVoucherDisplayLabel(
  description: string | null | undefined,
  voucherType: string | null | undefined,
) {
  const normalizedDescription = String(description ?? "").trim();
  return normalizedDescription || formatVoucherTypeLabel(voucherType);
}

function formatVoucherStatusLabel(value: string | null | undefined) {
  const key = String(value ?? "").trim().toLowerCase();
  return voucherStatusLabels[key] ?? (key || "-");
}

function formatTripStatusLabel(value: string | null | undefined) {
  const key = String(value ?? "").trim().toLowerCase();
  return tripStatusLabels[key] ?? (key || "-");
}

export async function lookupPainelBilheteriaTicketByVoucherId(
  rawVoucherId: string,
): Promise<PainelBilheteriaTicketLookupResult> {
  const lookup = String(rawVoucherId ?? "").trim();
  const voucherId = Number(lookup);

  if (!lookup || !Number.isInteger(voucherId) || voucherId <= 0) {
    throw new PainelBilheteriaWorkstationError(
      "invalid_ticket_lookup",
      "Informe um ID do ingresso valido para consultar.",
    );
  }

  const pool = getIngressoDbPool();
  const result = await pool.query<TicketLookupRow>(
    `
      SELECT
        voucher.idvoucher,
        voucher.idcompra,
        compra.dtcompra::text AS dtcompra,
        voucher.dtuso::text AS dtuso
      FROM voucher
      LEFT JOIN compra ON compra.idcompra = voucher.idcompra
      WHERE voucher.idvoucher = $1
      LIMIT 1
    `,
    [voucherId],
  );
  const row = result.rows[0] ?? null;

  if (!row) {
    throw new PainelBilheteriaWorkstationError(
      "ticket_not_found",
      "Ingresso nao encontrado.",
      404,
    );
  }

  return {
    lookup,
    voucherId: row.idvoucher,
    purchaseId: row.idcompra ?? null,
    purchaseDate: row.dtcompra ? row.dtcompra.slice(0, 10) : null,
    usedDate: row.dtuso ? row.dtuso.slice(0, 10) : null,
    used: Boolean(String(row.dtuso ?? "").trim()),
  };
}

export async function lookupPainelBilheteriaCustomerDocument(
  rawDocument: string,
): Promise<PainelBilheteriaCustomerLookupResult> {
  const lookup = normalizeDocument(rawDocument);

  if (!lookup) {
    throw new PainelBilheteriaWorkstationError(
      "invalid_customer_document",
      "Informe um RG ou CPF para consultar.",
    );
  }

  const pool = getIngressoDbPool();
  const documentKind = lookup.length === 11 ? "cpf" : "rg";
  let customer: CustomerRow | null = null;
  let cpf = lookup.length === 11 ? lookup : null;

  if (documentKind === "cpf") {
    const customerResult = await pool.query<CustomerRow>(
      `
        SELECT cpf, nmusuario, rg
        FROM usuario
        WHERE cpf = $1
        LIMIT 1
      `,
      [lookup],
    );
    customer = customerResult.rows[0] ?? null;
  } else {
    const customerResult = await pool.query<CustomerRow>(
      `
        SELECT cpf, nmusuario, rg
        FROM usuario
        WHERE REPLACE(REPLACE(REPLACE(COALESCE(rg, ''), '.', ''), '/', ''), '-', '') = $1
        LIMIT 1
      `,
      [lookup],
    );
    customer = customerResult.rows[0] ?? null;
    cpf = customer?.cpf ?? null;
  }

  if (!cpf) {
    return {
      lookup,
      documentKind,
      customer: customer
        ? {
            cpf: customer.cpf,
            cpfLabel: formatPainelBilheteriaCpf(customer.cpf),
            name: customer.nmusuario,
            rg: customer.rg,
          }
        : null,
      purchases: [],
    };
  }

  const purchasesResult = await pool.query<CustomerPurchaseRow>(
    `
      SELECT
        c.idcompra,
        c.dtcompra::text AS dtcompra,
        c.cpf,
        c.tpcompra,
        c.stcompra,
        c.formapag,
        COALESCE(SUM(CASE WHEN v.stusado <> 'inv' THEN v.vlunicompra ELSE 0 END), 0)::text AS total_venda
      FROM compra c
      LEFT JOIN voucher v ON v.idcompra = c.idcompra
      WHERE c.cpf = $1
        AND c.stcompra = 'conc'
      GROUP BY c.idcompra, c.dtcompra, c.cpf, c.tpcompra, c.stcompra, c.formapag
      ORDER BY c.idcompra DESC
      LIMIT 20
    `,
    [cpf],
  );
  const purchaseIds = purchasesResult.rows.map((row) => row.idcompra);
  const vouchersByPurchaseId = new Map<number, PainelBilheteriaLookupVoucher[]>();

  if (purchaseIds.length > 0) {
    const vouchersResult = await pool.query<CustomerVoucherRow>(
      `
        SELECT
          v.idcompra,
          v.idvoucher,
          v.numvoucher,
          v.tpvoucher,
          v.descricao,
          v.stusado,
          a.dtagenda::text AS agenda_data,
          v.vlunicompra::text AS vlunicompra
        FROM voucher v
        LEFT JOIN agenda a ON a.idagenda = v.idagenda
        WHERE v.idcompra = ANY($1::int[])
        ORDER BY v.idcompra DESC, v.idvoucher DESC
      `,
      [purchaseIds],
    );

    for (const row of vouchersResult.rows) {
      const current = vouchersByPurchaseId.get(row.idcompra) ?? [];
      current.push({
        voucherId: row.idvoucher,
        voucherNumber: row.numvoucher,
        voucherTypeCode: row.tpvoucher,
        statusCode: row.stusado,
        voucherTypeLabel: resolveVoucherDisplayLabel(row.descricao, row.tpvoucher),
        statusLabel: formatVoucherStatusLabel(row.stusado),
        visitDate: row.agenda_data ? row.agenda_data.slice(0, 10) : null,
        unitValue: formatPainelBilheteriaMoney(row.vlunicompra),
      });
      vouchersByPurchaseId.set(row.idcompra, current);
    }
  }

  return {
    lookup,
    documentKind,
    customer: customer
      ? {
          cpf: customer.cpf,
          cpfLabel: formatPainelBilheteriaCpf(customer.cpf),
          name: customer.nmusuario,
          rg: customer.rg,
        }
      : {
          cpf,
          cpfLabel: formatPainelBilheteriaCpf(cpf),
          name: null,
          rg: null,
        },
    purchases: purchasesResult.rows.map((row) => ({
      purchaseId: row.idcompra,
      purchaseDate: row.dtcompra ? row.dtcompra.slice(0, 10) : null,
      cpf: row.cpf,
      cpfLabel: formatPainelBilheteriaCpf(row.cpf),
      purchaseTypeCode: row.tpcompra,
      statusCode: row.stcompra,
      purchaseTypeLabel: formatPurchaseTypeLabel(row.tpcompra),
      statusLabel: formatPurchaseStatusLabel(row.stcompra),
      paymentLabel: formatPaymentLabel(row.formapag),
      totalValue: formatPainelBilheteriaMoney(row.total_venda),
      vouchers: vouchersByPurchaseId.get(row.idcompra) ?? [],
    })),
  };
}

export async function lookupPainelBilheteriaTrip(
  rawCode: string,
): Promise<PainelBilheteriaTripLookupResult> {
  const lookup = String(rawCode ?? "").trim();

  if (!lookup) {
    throw new PainelBilheteriaWorkstationError(
      "invalid_trip_code",
      "Informe um código de passeio para consultar.",
    );
  }

  const pool = getIngressoDbPool();
  const result = await pool.query<TripVoucherRow>(
    `
      SELECT
        ed.codescoladata,
        e.nmescola,
        a.dtagenda::text AS dtagenda,
        ed.status,
        ed.idescola,
        ed.idagenda,
        v.idcompra,
        v.idvoucher,
        v.numvoucher,
        v.tpvoucher,
        v.descricao,
        v.stusado,
        v.nomealuno,
        v.turma,
        v.periodo,
        c.tpcompra
      FROM escoladata ed
      JOIN escola e ON e.idescola = ed.idescola
      JOIN agenda a ON a.idagenda = ed.idagenda
      JOIN voucher v ON v.idagenda = ed.idagenda AND v.idescola = ed.idescola
      LEFT JOIN compra c ON c.idcompra = v.idcompra
      WHERE ed.codescoladata = $1
        AND COALESCE(c.stcompra, '') <> 'canc'
      ORDER BY v.nomealuno ASC, v.idvoucher ASC
    `,
    [lookup],
  );

  const first = result.rows[0] ?? null;

  return {
    lookup,
    schoolId: first?.idescola ?? null,
    agendaId: first?.idagenda ?? null,
    schoolName: first?.nmescola ?? null,
    visitDate: first?.dtagenda ? first.dtagenda.slice(0, 10) : null,
    statusLabel: formatTripStatusLabel(first?.status),
    items: result.rows.map((row) => ({
      voucherId: row.idvoucher,
      purchaseId: row.idcompra ?? null,
      voucherNumber: row.numvoucher,
      voucherTypeCode: row.tpvoucher,
      statusCode: row.stusado,
      voucherTypeLabel: resolveVoucherDisplayLabel(row.descricao, row.tpvoucher),
      statusLabel: formatVoucherStatusLabel(row.stusado),
      studentName: row.nomealuno,
      className: row.turma,
      periodName: row.periodo,
      purchaseTypeCode: row.tpcompra,
      purchaseTypeLabel: formatPurchaseTypeLabel(row.tpcompra),
    })),
  };
}

export function formatPainelBilheteriaLookupDate(
  value: string | null | undefined,
) {
  return formatPainelBilheteriaDate(value);
}
