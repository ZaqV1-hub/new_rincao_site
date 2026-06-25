import { formatCpf, sanitizeCpf } from "@/lib/cpf";
import { getIngressoDbPool } from "@/lib/ingresso-db";
import {
  asOpsAdminMasterDataError,
  updateOpsAdminMasterData,
} from "@/lib/ops-admin-master-data";

type UsuarioSiteRow = {
  cpf: string;
  nmusuario: string | null;
  email: string | null;
  stusuario: string | null;
  dtcadastro: string | null;
  dtulogin: string | null;
  hrulogin: string | null;
  rg: string | null;
  dtnascimento: string | null;
  sexo: string | null;
  telefone: string | null;
  celular: string | null;
  endereco: string | null;
  numero: string | null;
  cep: string | null;
  bairro: string | null;
  nmcidade: string | null;
  uf: string | null;
  complemento: string | null;
};

type ConvenioRow = {
  idconvenio: number;
  nmconvenio: string | null;
};

export type PainelUsuarioSiteListItem = {
  cpf: string;
  cpfLabel: string;
  name: string;
  email: string;
  createdAt: string | null;
  createdAtLabel: string;
  status: "ati" | "ina";
  statusLabel: string;
};

export type PainelUsuarioSiteListResult = {
  filters: {
    nmusuario: string;
    cpfusuario: string;
    emailusuario: string;
    stusuario: string;
    dtcadastroDe: string;
    dtcadastroAte: string;
  };
  items: PainelUsuarioSiteListItem[];
  page: number;
  per: number;
  total: number;
  pageCount: number;
  start: number;
  end: number;
};

export type PainelUsuarioSiteAgreement = {
  id: number;
  name: string;
};

export type PainelUsuarioSiteDetail = PainelUsuarioSiteListItem & {
  rg: string;
  birthDateLabel: string;
  sexLabel: string;
  phone: string;
  mobile: string;
  address: string;
  number: string;
  cep: string;
  district: string;
  regionLabel: string;
  complement: string;
  lastLoginLabel: string;
  userType: "ASSOCIADO / CONVENIADO" | "ASSOCIADO" | "CONVENIADO" | "NORMAL";
  agreements: PainelUsuarioSiteAgreement[];
};

export class PainelUsuarioSiteError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "PainelUsuarioSiteError";
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
  if (normalized === "-1" || normalized === "all") {
    return "-1";
  }
  if (normalized === "ina") {
    return "ina";
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

function formatLastLoginLabel(date: string | null | undefined, time: string | null | undefined) {
  if (!date) {
    return "-";
  }
  return time ? `${formatDateLabel(date)} as ${time}` : formatDateLabel(date);
}

function mapSexLabel(value: string | null | undefined) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "m") {
    return "Masculino";
  }
  if (normalized === "f") {
    return "Feminino";
  }
  return "-";
}

function mapStatusLabel(status: string | null | undefined) {
  return status === "ina" ? "Inativo" : "Ativo";
}

function mapUserType(hasAssociate: boolean, agreementsCount: number) {
  if (hasAssociate && agreementsCount > 0) {
    return "ASSOCIADO / CONVENIADO" as const;
  }
  if (hasAssociate) {
    return "ASSOCIADO" as const;
  }
  if (agreementsCount > 0) {
    return "CONVENIADO" as const;
  }
  return "NORMAL" as const;
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

function assertCpf(value: unknown) {
  const cpf = sanitizeCpf(String(value ?? ""));
  if (cpf.length !== 11) {
    throw new PainelUsuarioSiteError("invalid_site_user_cpf", "Informe um CPF valido.", 400);
  }
  return cpf;
}

function mapListItem(row: UsuarioSiteRow): PainelUsuarioSiteListItem {
  const status = row.stusuario === "ina" ? "ina" : "ati";

  return {
    cpf: sanitizeCpf(row.cpf),
    cpfLabel: formatCpf(row.cpf),
    name: normalizeText(row.nmusuario) || "-",
    email: normalizeText(row.email) || "-",
    createdAt: row.dtcadastro,
    createdAtLabel: formatDateLabel(row.dtcadastro),
    status,
    statusLabel: mapStatusLabel(status),
  };
}

function buildListWhere(filters: {
  name: string;
  cpf: string;
  email: string;
  status: string;
  createdFrom: string;
  createdTo: string;
}) {
  const clauses = ["usuario.idpapel IS NULL"];
  const params: Array<string | number> = [];

  if (filters.status !== "-1") {
    params.push(filters.status === "ina" ? "ina" : "ati");
    clauses.push(`usuario.stusuario = $${params.length}`);
  }

  if (filters.name) {
    params.push(`%${filters.name}%`);
    clauses.push(`usuario.nmusuario ILIKE $${params.length}`);
  }

  if (filters.cpf) {
    params.push(filters.cpf);
    clauses.push(`usuario.cpf = $${params.length}`);
  }

  if (filters.email) {
    params.push(`%${filters.email}%`);
    clauses.push(`usuario.email ILIKE $${params.length}`);
  }

  if (filters.createdFrom && isIsoDate(filters.createdFrom)) {
    params.push(filters.createdFrom);
    clauses.push(`usuario.dtcadastro >= $${params.length}`);
  }

  if (filters.createdTo && isIsoDate(filters.createdTo)) {
    params.push(filters.createdTo);
    clauses.push(`usuario.dtcadastro <= $${params.length}`);
  }

  return {
    whereSql: `WHERE ${clauses.join(" AND ")}`,
    params,
  };
}

async function getUsuarioSiteRaw(cpf: string) {
  const pool = getIngressoDbPool();
  const result = await pool.query<UsuarioSiteRow>(
    `
      SELECT
        usuario.cpf,
        usuario.nmusuario,
        usuario.email,
        usuario.stusuario,
        usuario.dtcadastro::text AS dtcadastro,
        usuario.dtulogin::text AS dtulogin,
        usuario.hrulogin,
        usuario.rg,
        usuario.dtnascimento::text AS dtnascimento,
        usuario.sexo,
        usuario.telefone,
        usuario.celular,
        usuario.endereco,
        usuario.numero::text AS numero,
        usuario.cep,
        usuario.bairro,
        cidade.nmcidade,
        usuario.uf,
        usuario.complemento
      FROM usuario
      LEFT JOIN cidade ON cidade.idcidade = usuario.cidade
      WHERE usuario.cpf = $1
        AND usuario.idpapel IS NULL
      LIMIT 1
    `,
    [cpf],
  );

  const row = result.rows[0];
  if (!row) {
    throw new PainelUsuarioSiteError(
      "site_user_not_found",
      "Usuario do site nao encontrado.",
      404,
    );
  }

  return row;
}

async function getUsuarioSiteRelationships(cpf: string) {
  const pool = getIngressoDbPool();
  const [associateResult, agreementsResult] = await Promise.all([
    pool.query<{ cpf: string }>(
      `
        SELECT cpf
        FROM socio
        WHERE cpf = $1
        LIMIT 1
      `,
      [cpf],
    ),
    pool.query<ConvenioRow>(
      `
        SELECT convenio.idconvenio, convenio.nmconvenio
        FROM conveniado
        JOIN convenio ON convenio.idconvenio = conveniado.idconvenio
        WHERE conveniado.cpf = $1
        ORDER BY convenio.nmconvenio ASC
      `,
      [cpf],
    ),
  ]);

  return {
    hasAssociate: Boolean(associateResult.rows[0]),
    agreements: agreementsResult.rows
      .filter((row) => normalizeText(row.nmconvenio))
      .map((row) => ({
        id: Number(row.idconvenio),
        name: normalizeText(row.nmconvenio),
      })),
  };
}

export function asPainelUsuarioSiteError(error: unknown) {
  if (error instanceof PainelUsuarioSiteError) {
    return error;
  }

  const mapped = asOpsAdminMasterDataError(error);
  return new PainelUsuarioSiteError(mapped.code, mapped.message, mapped.status);
}

export async function listPainelUsuariosSite(input: Record<string, unknown>) {
  const name = normalizeText(input.nmusuario);
  const cpf = sanitizeCpf(String(input.cpfusuario ?? ""));
  const email = normalizeText(input.emailusuario);
  const status = normalizeStatus(input.stusuario);
  const createdFrom = normalizeText(
    input["dtcadastro[de]"] ??
      (typeof input.dtcadastro === "object" && input.dtcadastro && "de" in input.dtcadastro
        ? (input.dtcadastro as { de?: unknown }).de
        : ""),
  );
  const createdTo = normalizeText(
    input["dtcadastro[ate]"] ??
      (typeof input.dtcadastro === "object" && input.dtcadastro && "ate" in input.dtcadastro
        ? (input.dtcadastro as { ate?: unknown }).ate
        : ""),
  );
  const page = parsePositiveInteger(input.page, 1);
  const per = parsePositiveInteger(input.per ?? input.pp, 30);
  const { whereSql, params } = buildListWhere({
    name,
    cpf,
    email,
    status,
    createdFrom,
    createdTo,
  });
  const pool = getIngressoDbPool();
  const countResult = await pool.query<{ total: string }>(
    `
      SELECT COUNT(*)::text AS total
      FROM usuario
      ${whereSql}
    `,
    params,
  );
  const total = Number(countResult.rows[0]?.total ?? 0);
  const paging = paginate(total, page, per);
  const result = await pool.query<UsuarioSiteRow>(
    `
      SELECT
        usuario.cpf,
        usuario.nmusuario,
        usuario.email,
        usuario.stusuario,
        usuario.dtcadastro::text AS dtcadastro,
        usuario.dtulogin::text AS dtulogin,
        usuario.hrulogin,
        NULL::text AS rg,
        NULL::text AS dtnascimento,
        NULL::text AS sexo,
        NULL::text AS telefone,
        NULL::text AS celular,
        NULL::text AS endereco,
        NULL::text AS numero,
        NULL::text AS cep,
        NULL::text AS bairro,
        NULL::text AS nmcidade,
        NULL::text AS uf,
        NULL::text AS complemento
      FROM usuario
      ${whereSql}
      ORDER BY usuario.nmusuario ASC, usuario.cpf ASC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `,
    [...params, paging.per, paging.startIndex],
  );

  return {
    filters: {
      nmusuario: name,
      cpfusuario: formatCpf(cpf),
      emailusuario: email,
      stusuario: status,
      dtcadastroDe: createdFrom,
      dtcadastroAte: createdTo,
    },
    items: result.rows.map(mapListItem),
    page: paging.page,
    per: paging.per,
    total,
    pageCount: paging.pageCount,
    start: paging.start,
    end: paging.end,
  } satisfies PainelUsuarioSiteListResult;
}

export async function getPainelUsuarioSite(cpf: unknown) {
  const normalizedCpf = assertCpf(cpf);
  const [row, relationships] = await Promise.all([
    getUsuarioSiteRaw(normalizedCpf),
    getUsuarioSiteRelationships(normalizedCpf),
  ]);
  const listItem = mapListItem(row);

  return {
    ...listItem,
    rg: normalizeText(row.rg) || "-",
    birthDateLabel: formatDateLabel(row.dtnascimento),
    sexLabel: mapSexLabel(row.sexo),
    phone: normalizeText(row.telefone) || "-",
    mobile: normalizeText(row.celular) || "-",
    address: normalizeText(row.endereco) || "-",
    number: normalizeText(row.numero) || "-",
    cep: normalizeText(row.cep) || "-",
    district: normalizeText(row.bairro) || "-",
    regionLabel:
      normalizeText(row.nmcidade) && normalizeText(row.uf)
        ? `${normalizeText(row.nmcidade)} - ${normalizeText(row.uf)}`
        : "-",
    complement: normalizeText(row.complemento) || "-",
    lastLoginLabel: formatLastLoginLabel(row.dtulogin, row.hrulogin),
    userType: mapUserType(relationships.hasAssociate, relationships.agreements.length),
    agreements: relationships.agreements,
  } satisfies PainelUsuarioSiteDetail;
}

export async function updatePainelUsuarioSiteEmail(cpf: unknown, email: unknown) {
  const normalizedCpf = assertCpf(cpf);
  const normalizedEmail = normalizeText(email);

  if (!normalizedEmail) {
    throw new PainelUsuarioSiteError(
      "invalid_site_user_email",
      "Informe o e-mail.",
      400,
    );
  }

  return updateOpsAdminMasterData("site-users", {
    id: normalizedCpf,
    values: {
      email: normalizedEmail,
    },
  });
}

export async function updatePainelUsuarioSiteStatus(input: {
  cpf: unknown;
  status: unknown;
  actorCpf?: string | null;
}) {
  const normalizedCpf = assertCpf(input.cpf);
  const actorCpf = input.actorCpf ? sanitizeCpf(input.actorCpf) : "";

  if (actorCpf && actorCpf === normalizedCpf) {
    throw new PainelUsuarioSiteError(
      "site_user_self_status_forbidden",
      "Nao e permitido alterar o seu proprio status.",
      403,
    );
  }

  const status = normalizeText(input.status).toLowerCase() === "ina" ? "ina" : "ati";

  return updateOpsAdminMasterData("site-users", {
    id: normalizedCpf,
    values: {
      status,
    },
  });
}

export async function exportPainelUsuariosSite(input: Record<string, unknown>) {
  const list = await listPainelUsuariosSite({
    ...input,
    page: "1",
    per: "100000",
  });
  const detailRows = await Promise.all(list.items.map((item) => getPainelUsuarioSite(item.cpf)));

  return detailRows.map((item) => ({
    cpf: item.cpfLabel,
    nome: item.name,
    rg: item.rg,
    nascimento: item.birthDateLabel,
    sexo: item.sexLabel,
    email: item.email === "-" ? "" : item.email,
    telefone: item.phone,
    celular: item.mobile,
    endereco: item.address,
    numero: item.number,
    cep: item.cep,
    bairro: item.district,
    regiao: item.regionLabel,
    complemento: item.complement,
    status: item.statusLabel,
    cadastro: item.createdAtLabel,
    ultimoLogin: item.lastLoginLabel,
    tipoUsuario: item.userType,
  }));
}
