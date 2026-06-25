import { formatCpf, sanitizeCpf } from "@/lib/cpf";
import { getIngressoDbPool } from "@/lib/ingresso-db";
import {
  asOpsAdminMasterDataError,
  createOpsAdminMasterData,
  deleteOpsAdminMasterData,
  listOpsAdminMasterData,
  updateOpsAdminMasterData,
} from "@/lib/ops-admin-master-data";

type SocioRawRow = {
  cpf: string;
  nmsocio: string | null;
  idsociocateg: number | null;
  nmcategoria: string | null;
  dtinisoc: string | null;
  dtfimsoc: string | null;
  qtcompradia: number | string | null;
  stsocio: string | null;
  dtcadastro: string | null;
};

type CategoriaRawItem = {
  idsociocateg: number;
  nmcategoria: string | null;
};

export type PainelSocioListItem = {
  cpf: string;
  cpfLabel: string;
  name: string;
  categoryId: number | null;
  categoryName: string;
  startDate: string | null;
  startDateLabel: string;
  endDate: string | null;
  endDateLabel: string;
  dailyPurchaseLimit: number | null;
  status: "ati" | "ina";
  statusLabel: string;
};

export type PainelSocioDetail = PainelSocioListItem & {
  createdAt: string | null;
  createdAtLabel: string;
};

export type PainelSociosListResult = {
  filters: {
    cpf: string;
    nmsocio: string;
    idsociocateg: string;
    stsocio: string;
    periodoDe: string;
    periodoAte: string;
  };
  items: PainelSocioListItem[];
  page: number;
  per: number;
  total: number;
  pageCount: number;
  start: number;
  end: number;
  categoryOptions: Array<{ id: number; name: string }>;
};

export type PainelSocioFormValues = {
  cpf: string;
  dtinisoc: string;
  dtfimsoc: string;
  nmsocio: string;
  qtcompradia: string;
  idsociocateg: string;
  stsocio?: string;
};

export class PainelSociosError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "PainelSociosError";
    this.code = code;
    this.status = status;
  }
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function parsePositiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeStatus(value: unknown) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "ina") {
    return "ina";
  }
  if (normalized === "-1" || normalized === "all") {
    return "-1";
  }
  return "ati";
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return value;
  }

  return `${match[3]}/${match[2]}/${match[1]}`;
}

function mapStatusLabel(status: string | null | undefined) {
  return status === "ina" ? "Inativo" : "Ativo";
}

function mapSocio(row: SocioRawRow): PainelSocioListItem {
  const status = row.stsocio === "ina" ? "ina" : "ati";

  return {
    cpf: sanitizeCpf(row.cpf),
    cpfLabel: formatCpf(row.cpf),
    name: normalizeText(row.nmsocio) || "-",
    categoryId: row.idsociocateg == null ? null : Number(row.idsociocateg),
    categoryName: normalizeText(row.nmcategoria) || "-",
    startDate: row.dtinisoc,
    startDateLabel: formatDateLabel(row.dtinisoc),
    endDate: row.dtfimsoc,
    endDateLabel: formatDateLabel(row.dtfimsoc),
    dailyPurchaseLimit:
      row.qtcompradia == null ? null : Number(row.qtcompradia),
    status,
    statusLabel: mapStatusLabel(status),
  };
}

function paginate(total: number, page: number, per: number) {
  const pageCount = Math.max(1, Math.ceil(total / per));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const startIndex = (safePage - 1) * per;

  return {
    page: safePage,
    per,
    pageCount,
    startIndex,
    start: total === 0 ? 0 : startIndex + 1,
    end: total === 0 ? 0 : Math.min(total, startIndex + per),
  };
}

function normalizePeriodValue(value: unknown) {
  return normalizeText(value);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function assertSocioCpf(value: unknown) {
  const cpf = sanitizeCpf(String(value ?? ""));

  if (cpf.length !== 11) {
    throw new PainelSociosError("invalid_member_cpf", "Informe um CPF valido.", 400);
  }

  return cpf;
}

function assertSocioPayload(values: PainelSocioFormValues) {
  const cpf = assertSocioCpf(values.cpf);
  const startDate = normalizeText(values.dtinisoc);
  const endDate = normalizeText(values.dtfimsoc);
  const name = normalizeText(values.nmsocio);
  const categoryId = Number(values.idsociocateg);
  const dailyPurchaseLimit = Number(values.qtcompradia);

  if (!isIsoDate(startDate)) {
    throw new PainelSociosError(
      "invalid_member_start_date",
      "Informe a data de inicio.",
      400,
    );
  }

  if (!isIsoDate(endDate)) {
    throw new PainelSociosError(
      "invalid_member_end_date",
      "Informe a data de fim.",
      400,
    );
  }

  if (endDate < startDate) {
    throw new PainelSociosError(
      "invalid_member_period",
      "A data fim deve ser igual ou posterior a data inicio.",
      400,
    );
  }

  if (!name) {
    throw new PainelSociosError("invalid_member_name", "Informe o nome do socio.", 400);
  }

  if (!Number.isInteger(dailyPurchaseLimit)) {
    throw new PainelSociosError(
      "invalid_member_daily_limit",
      "Informe a quantidade de compra por dia.",
      400,
    );
  }

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new PainelSociosError(
      "invalid_member_category",
      "Informe a categoria do socio.",
      400,
    );
  }

  return {
    cpf,
    startDate,
    endDate,
    name,
    categoryId,
    dailyPurchaseLimit,
  };
}

export function validatePainelSocioActivation(input: {
  status: string;
  endDate: string | null;
  today?: string;
}) {
  if (input.status !== "ati") {
    return;
  }

  const today = input.today ?? todayIso();
  if (!input.endDate || !isIsoDate(input.endDate) || input.endDate <= today) {
    throw new PainelSociosError(
      "invalid_member_activation_term",
      "Data de vigencia invalida. Favor, altere a data para ativar o socio.",
      400,
    );
  }
}

export function asPainelSociosError(error: unknown) {
  if (error instanceof PainelSociosError) {
    return error;
  }

  const mapped = asOpsAdminMasterDataError(error);
  return new PainelSociosError(mapped.code, mapped.message, mapped.status);
}

export async function listPainelSocioCategoryOptions() {
  const result = await listOpsAdminMasterData("membership-categories");
  return (result.items as CategoriaRawItem[])
    .map((item) => ({
      id: Number(item.idsociocateg),
      name: normalizeText(item.nmcategoria) || "-",
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

export async function getPainelSocioFormContext() {
  return {
    categoryOptions: await listPainelSocioCategoryOptions(),
  };
}

function buildListWhere(filters: {
  cpf: string;
  name: string;
  categoryId: number | null;
  status: string;
  periodFrom: string;
  periodTo: string;
}) {
  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (filters.status === "-1") {
    // todos
  } else {
    params.push(filters.status === "ina" ? "ina" : "ati");
    clauses.push(`socio.stsocio = $${params.length}`);
  }

  if (filters.cpf) {
    params.push(filters.cpf);
    clauses.push(`socio.cpf = $${params.length}`);
  }

  if (filters.name) {
    params.push(`%${filters.name}%`);
    clauses.push(`socio.nmsocio ILIKE $${params.length}`);
  }

  if (filters.categoryId) {
    params.push(filters.categoryId);
    clauses.push(`socio.idsociocateg = $${params.length}`);
  }

  if (filters.periodFrom && isIsoDate(filters.periodFrom)) {
    params.push(filters.periodFrom);
    clauses.push(`socio.dtinisoc >= $${params.length}`);
  }

  if (filters.periodTo && isIsoDate(filters.periodTo)) {
    params.push(filters.periodTo);
    clauses.push(`socio.dtfimsoc <= $${params.length}`);
  }

  return {
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

async function getPainelSocioRaw(cpf: unknown) {
  const normalizedCpf = assertSocioCpf(cpf);
  const pool = getIngressoDbPool();
  const result = await pool.query<SocioRawRow>(
    `
      SELECT
        socio.cpf,
        socio.nmsocio,
        socio.idsociocateg,
        sociocateg.nmcategoria,
        socio.dtinisoc::text AS dtinisoc,
        socio.dtfimsoc::text AS dtfimsoc,
        socio.qtcompradia,
        socio.stsocio,
        socio.dtcadastro::text AS dtcadastro
      FROM socio
      JOIN sociocateg ON sociocateg.idsociocateg = socio.idsociocateg
      WHERE socio.cpf = $1
      LIMIT 1
    `,
    [normalizedCpf],
  );

  const found = result.rows[0];
  if (!found) {
    throw new PainelSociosError("member_not_found", "Socio nao encontrado.", 404);
  }

  return found;
}

export async function listPainelSocios(input: Record<string, unknown>) {
  const cpf = sanitizeCpf(String(input.cpf ?? ""));
  const name = normalizeText(input.nmsocio);
  const categoryId = Number(input.idsociocateg);
  const status = normalizeStatus(input.stsocio);
  const periodFrom = normalizePeriodValue(
    input["periodo[de]"] ??
      (typeof input.periodo === "object" && input.periodo && "de" in input.periodo
        ? (input.periodo as { de?: unknown }).de
        : ""),
  );
  const periodTo = normalizePeriodValue(
    input["periodo[ate]"] ??
      (typeof input.periodo === "object" && input.periodo && "ate" in input.periodo
        ? (input.periodo as { ate?: unknown }).ate
        : ""),
  );
  const page = parsePositiveInteger(input.page, 1);
  const per = parsePositiveInteger(input.per ?? input.pp, 30);
  const categoryOptions = await listPainelSocioCategoryOptions();
  const filterState = {
    cpf,
    name,
    categoryId: Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null,
    status,
    periodFrom,
    periodTo,
  };
  const { whereSql, params } = buildListWhere(filterState);
  const pool = getIngressoDbPool();
  const countResult = await pool.query<{ total: string }>(
    `
      SELECT COUNT(*)::text AS total
      FROM socio
      JOIN sociocateg ON sociocateg.idsociocateg = socio.idsociocateg
      ${whereSql}
    `,
    params,
  );
  const total = Number(countResult.rows[0]?.total ?? 0);
  const paging = paginate(total, page, per);
  const listResult = await pool.query<SocioRawRow>(
    `
      SELECT
        socio.cpf,
        socio.nmsocio,
        socio.idsociocateg,
        sociocateg.nmcategoria,
        socio.dtinisoc::text AS dtinisoc,
        socio.dtfimsoc::text AS dtfimsoc,
        socio.qtcompradia,
        socio.stsocio,
        socio.dtcadastro::text AS dtcadastro
      FROM socio
      JOIN sociocateg ON sociocateg.idsociocateg = socio.idsociocateg
      ${whereSql}
      ORDER BY socio.nmsocio ASC, socio.cpf ASC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `,
    [...params, paging.per, paging.startIndex],
  );

  return {
    filters: {
      cpf: formatCpf(cpf),
      nmsocio: name,
      idsociocateg: filterState.categoryId ? String(filterState.categoryId) : "",
      stsocio: status,
      periodoDe: periodFrom,
      periodoAte: periodTo,
    },
    items: listResult.rows.map(mapSocio),
    page: paging.page,
    per: paging.per,
    total,
    pageCount: paging.pageCount,
    start: paging.start,
    end: paging.end,
    categoryOptions,
  } satisfies PainelSociosListResult;
}

export async function getPainelSocio(cpf: unknown) {
  const row = await getPainelSocioRaw(cpf);
  const mapped = mapSocio(row);

  return {
    ...mapped,
    createdAt: row.dtcadastro,
    createdAtLabel: formatDateLabel(row.dtcadastro),
  } satisfies PainelSocioDetail;
}

export async function createPainelSocio(values: PainelSocioFormValues) {
  const normalized = assertSocioPayload(values);

  return createOpsAdminMasterData("members", {
    values: {
      cpf: normalized.cpf,
      startDate: normalized.startDate,
      endDate: normalized.endDate,
      name: normalized.name,
      dailyPurchaseLimit: normalized.dailyPurchaseLimit,
      categoryId: normalized.categoryId,
      status: "ati",
    },
  });
}

export async function updatePainelSocio(cpf: unknown, values: PainelSocioFormValues) {
  const currentCpf = assertSocioCpf(cpf);
  const normalized = assertSocioPayload(values);
  const status = normalizeText(values.stsocio).toLowerCase() === "ina" ? "ina" : "ati";

  validatePainelSocioActivation({
    status,
    endDate: normalized.endDate,
  });

  return updateOpsAdminMasterData("members", {
    id: currentCpf,
    values: {
      cpf: normalized.cpf,
      startDate: normalized.startDate,
      endDate: normalized.endDate,
      name: normalized.name,
      dailyPurchaseLimit: normalized.dailyPurchaseLimit,
      categoryId: normalized.categoryId,
      status,
    },
  });
}

export async function updatePainelSocioStatus(cpf: unknown, nextStatus: unknown) {
  const normalizedCpf = assertSocioCpf(cpf);
  const status = normalizeText(nextStatus).toLowerCase() === "ina" ? "ina" : "ati";
  const current = await getPainelSocioRaw(normalizedCpf);

  validatePainelSocioActivation({
    status,
    endDate: current.dtfimsoc,
  });

  return updateOpsAdminMasterData("members", {
    id: normalizedCpf,
    values: {
      status,
    },
  });
}

export async function removePainelSocio(cpf: unknown) {
  const normalizedCpf = assertSocioCpf(cpf);

  return deleteOpsAdminMasterData("members", {
    id: normalizedCpf,
  });
}
