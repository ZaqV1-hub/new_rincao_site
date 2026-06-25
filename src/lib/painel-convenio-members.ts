import {
  createAgreementMember,
  deleteAgreementMember,
  type OpsAgreementMemberError,
  updateAgreementMember,
} from "@/lib/ops-agreement-members";

export type PainelConvenioMembersFilters = {
  cpf: string | null;
  status: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  page: number;
  perPage: number;
};

export type PainelConvenioMemberListItem = {
  agreementId: number;
  agreementName: string | null;
  cpf: string;
  cpfLabel: string;
  userName: string | null;
  dailyPurchaseLimit: number;
  startDate: string | null;
  endDate: string | null;
  statusCode: string | null;
  statusLabel: string;
};

export type PainelConvenioMembersListResult = {
  agreementId: number;
  agreementName: string | null;
  items: PainelConvenioMemberListItem[];
  filters: PainelConvenioMembersFilters;
  page: number;
  perPage: number;
  total: number;
  pageCount: number;
  start: number;
  end: number;
};

export type PainelConvenioMemberDetail = {
  agreementId: number;
  agreementName: string | null;
  cpf: string;
  cpfLabel: string;
  userName: string | null;
  dailyPurchaseLimit: number;
  startDate: string | null;
  endDate: string | null;
  statusCode: string | null;
  statusLabel: string;
  createdAt: string | null;
  userDocument: string | null;
  userRg: string | null;
  birthDate: string | null;
  genderLabel: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  address: string | null;
  zipCode: string | null;
  district: string | null;
  cityLabel: string | null;
  complement: string | null;
  userStatusLabel: string | null;
  userCreatedAt: string | null;
  lastLoginLabel: string | null;
};

export type PainelConvenioMemberFormValues = {
  cpf: string;
  qtcompradia: string;
  dtiniado: string;
  dtfimado: string;
};

export class PainelConvenioMembersError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "PainelConvenioMembersError";
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

function parseDate(value: unknown) {
  const raw = normalizeText(value);
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const normalized = isoMatch
    ? raw
    : brMatch
      ? `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`
      : "";

  if (!normalized) {
    return null;
  }

  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
    return null;
  }

  return normalized;
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatCpf(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D+/g, "");
  if (digits.length !== 11) {
    return value ?? "-";
  }

  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function normalizeStatus(value: unknown) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "ati" || normalized === "ativo") {
    return "ati" as const;
  }
  if (normalized === "ina" || normalized === "inativo") {
    return "ina" as const;
  }
  return null;
}

function formatStatusLabel(status: string | null | undefined) {
  return status === "ati" ? "Ativo" : status === "ina" ? "Inativo" : "-";
}

function formatGenderLabel(value: string | null | undefined) {
  return value === "mas"
    ? "Masculino"
    : value === "fem"
      ? "Feminino"
      : value ?? null;
}

function formatLastLogin(date: string | null | undefined, time: string | null | undefined) {
  const dateLabel = formatDateLabel(date);
  if (!dateLabel) {
    return null;
  }

  return time ? `${dateLabel} as ${time}` : dateLabel;
}

export function normalizePainelConvenioMembersFilters(
  agreementId: unknown,
  input: Record<string, unknown>,
): PainelConvenioMembersFilters {
  const parsedAgreementId = Number(agreementId);
  if (!Number.isInteger(parsedAgreementId) || parsedAgreementId <= 0) {
    throw new PainelConvenioMembersError(
      "invalid_agreement_id",
      "Informe um convenio valido.",
      400,
    );
  }

  return {
    cpf: normalizeText(input.cpf).replace(/\D+/g, "") || null,
    status: normalizeText(input.stconveniado) || null,
    periodFrom: normalizeText(input["periodo[de]"]) || null,
    periodTo: normalizeText(input["periodo[ate]"]) || null,
    page: parsePositiveInteger(input.page, 1),
    perPage: parsePositiveInteger(input.pp, 10),
  };
}

function mapMemberRow(row: {
  idconvenio: number;
  nmconvenio: string | null;
  cpf: string;
  qtcompradia: number | string | null;
  dtiniado: string | null;
  dtfimado: string | null;
  stconveniado: string | null;
  nmusuario: string | null;
}): PainelConvenioMemberListItem {
  return {
    agreementId: Number(row.idconvenio),
    agreementName: row.nmconvenio,
    cpf: row.cpf,
    cpfLabel: formatCpf(row.cpf),
    userName: row.nmusuario,
    dailyPurchaseLimit: Number(row.qtcompradia ?? 0),
    startDate: formatDateLabel(row.dtiniado),
    endDate: formatDateLabel(row.dtfimado),
    statusCode: row.stconveniado,
    statusLabel: formatStatusLabel(row.stconveniado),
  };
}

export function validateConveniadoActivation(input: {
  status: string;
  endDate: string | null;
  today?: string;
}) {
  if (input.status !== "ati") {
    return;
  }

  const today = input.today ?? new Date().toISOString().slice(0, 10);
  if (input.endDate && input.endDate < today) {
    throw new PainelConvenioMembersError(
      "agreement_member_activation_period_invalid",
      "Data de vigencia invalida. Favor, altere a data para ativar o conveniado.",
      422,
    );
  }
}

export function validatePainelConvenioMemberForm(input: PainelConvenioMemberFormValues) {
  const cpf = normalizeText(input.cpf).replace(/\D+/g, "");
  const dailyPurchaseLimit = Number(input.qtcompradia);
  const startDate = parseDate(input.dtiniado);
  const endDate = parseDate(input.dtfimado);

  if (!/^\d{11}$/.test(cpf)) {
    throw new PainelConvenioMembersError(
      "invalid_agreement_member_form",
      "CPF invalido.",
      422,
    );
  }

  if (!Number.isInteger(dailyPurchaseLimit) || dailyPurchaseLimit <= 0) {
    throw new PainelConvenioMembersError(
      "invalid_agreement_member_form",
      "Quantidade de compra por dia obrigatoria.",
      422,
    );
  }

  if (!startDate) {
    throw new PainelConvenioMembersError(
      "invalid_agreement_member_form",
      "Data inicio obrigatoria.",
      422,
    );
  }

  if (!endDate) {
    throw new PainelConvenioMembersError(
      "invalid_agreement_member_form",
      "Data fim obrigatoria.",
      422,
    );
  }

  if (endDate < startDate) {
    throw new PainelConvenioMembersError(
      "invalid_agreement_member_form",
      "Data fim deve ser maior ou igual a data inicio.",
      422,
    );
  }

  return {
    cpf,
    dailyPurchaseLimit,
    startDate,
    endDate,
  };
}

function buildMembersWhere(filters: PainelConvenioMembersFilters) {
  const clauses = ["conveniado.idconvenio = $1"];
  const values: Array<string | number> = [];

  const cpf = filters.cpf ? filters.cpf.replace(/\D+/g, "") : null;
  const status =
    filters.status && filters.status !== "-1"
      ? normalizeStatus(filters.status)
      : null;
  const periodFrom = filters.periodFrom ? parseDate(filters.periodFrom) : null;
  const periodTo = filters.periodTo ? parseDate(filters.periodTo) : null;

  if (filters.status && filters.status !== "-1" && !status) {
    throw new PainelConvenioMembersError(
      "invalid_agreement_member_filter",
      "Informe um status valido para filtrar.",
      400,
    );
  }

  if (filters.periodFrom && !periodFrom) {
    throw new PainelConvenioMembersError(
      "invalid_agreement_member_filter",
      "Informe uma data inicial de vigencia valida.",
      400,
    );
  }

  if (filters.periodTo && !periodTo) {
    throw new PainelConvenioMembersError(
      "invalid_agreement_member_filter",
      "Informe uma data final de vigencia valida.",
      400,
    );
  }

  values.push(cpf || "");
  if (cpf) {
    clauses.push(`conveniado.cpf = $${values.length + 1}`);
    values.push(cpf);
  } else {
    values.pop();
  }

  if (status) {
    values.push(status);
    clauses.push(`conveniado.stconveniado = $${values.length}`);
  }

  if (periodFrom) {
    values.push(periodFrom);
    clauses.push(`conveniado.dtiniado >= $${values.length}::date`);
  }

  if (periodTo) {
    values.push(periodTo);
    clauses.push(`conveniado.dtfimado <= $${values.length}::date`);
  }

  return {
    where: clauses.join(" AND "),
    values,
  };
}

export async function listPainelConvenioMembers(input: {
  agreementId: unknown;
  filters?: Record<string, unknown>;
  page?: unknown;
}) {
  const { getIngressoDbPool } = await import("@/lib/ingresso-db");
  const agreementId = Number(input.agreementId);
  const filters = normalizePainelConvenioMembersFilters(input.agreementId, {
    ...(input.filters ?? {}),
    page: input.page ?? (input.filters?.page as unknown),
  });

  const pool = getIngressoDbPool();
  const agreementResult = await pool.query<{ idconvenio: number; nmconvenio: string | null }>(
    `
      SELECT idconvenio, nmconvenio
      FROM convenio
      WHERE idconvenio = $1
      LIMIT 1
    `,
    [agreementId],
  );

  const agreement = agreementResult.rows[0];
  if (!agreement) {
    throw new PainelConvenioMembersError(
      "agreement_not_found",
      "Convenio nao encontrado.",
      404,
    );
  }

  const { where, values } = buildMembersWhere(filters);
  const limit = filters.perPage;
  const offset = (filters.page - 1) * filters.perPage;

  const [listResult, countResult] = await Promise.all([
    pool.query<{
      idconvenio: number;
      nmconvenio: string | null;
      cpf: string;
      qtcompradia: number | string | null;
      dtiniado: string | null;
      dtfimado: string | null;
      stconveniado: string | null;
      nmusuario: string | null;
    }>(
      `
        SELECT
          conveniado.idconvenio,
          convenio.nmconvenio,
          conveniado.cpf,
          conveniado.qtcompradia,
          conveniado.dtiniado,
          conveniado.dtfimado,
          conveniado.stconveniado,
          usuario.nmusuario
        FROM conveniado
        JOIN convenio ON convenio.idconvenio = conveniado.idconvenio
        LEFT JOIN usuario ON usuario.cpf = conveniado.cpf
        WHERE ${where}
        ORDER BY conveniado.dtcadastro ASC NULLS LAST, conveniado.cpf ASC
        LIMIT $${values.length + 2}
        OFFSET $${values.length + 3}
      `,
      [agreementId, ...values, limit, offset],
    ),
    pool.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM conveniado
        WHERE ${where}
      `,
      [agreementId, ...values],
    ),
  ]);

  const total = Number(countResult.rows[0]?.total ?? 0);
  const items = listResult.rows.map(mapMemberRow);
  const start = total === 0 ? 0 : offset + 1;
  const end = total === 0 ? 0 : offset + items.length;

  return {
    agreementId,
    agreementName: agreement.nmconvenio,
    items,
    filters,
    page: filters.page,
    perPage: filters.perPage,
    total,
    pageCount: Math.max(1, Math.ceil(total / filters.perPage)),
    start,
    end,
  } satisfies PainelConvenioMembersListResult;
}

export async function getPainelConvenioMemberDetail(input: {
  agreementId: unknown;
  memberId: unknown;
}) {
  const { getIngressoDbPool } = await import("@/lib/ingresso-db");
  const agreementId = Number(input.agreementId);
  const memberId = normalizeText(input.memberId).replace(/\D+/g, "");

  if (!Number.isInteger(agreementId) || agreementId <= 0) {
    throw new PainelConvenioMembersError(
      "invalid_agreement_id",
      "Informe um convenio valido.",
      400,
    );
  }

  if (!/^\d{11}$/.test(memberId)) {
    throw new PainelConvenioMembersError(
      "invalid_agreement_member_id",
      "Informe um CPF valido.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const result = await pool.query<{
    idconvenio: number;
    nmconvenio: string | null;
    cpf: string;
    qtcompradia: number | string | null;
    dtiniado: string | null;
    dtfimado: string | null;
    stconveniado: string | null;
    dtcadastro: string | null;
    nmusuario: string | null;
    rg: string | null;
    dtnascimento: string | null;
    sexo: string | null;
    email: string | null;
    telefone: string | null;
    celular: string | null;
    endereco: string | null;
    cep: string | null;
    bairro: string | null;
    nmcidade: string | null;
    uf: string | null;
    complemento: string | null;
    stusuario: string | null;
    dtcadastro_usuario: string | null;
    dtulogin: string | null;
    hrulogin: string | null;
  }>(
    `
      SELECT
        conveniado.idconvenio,
        convenio.nmconvenio,
        conveniado.cpf,
        conveniado.qtcompradia,
        conveniado.dtiniado,
        conveniado.dtfimado,
        conveniado.stconveniado,
        conveniado.dtcadastro,
        usuario.nmusuario,
        usuario.rg,
        usuario.dtnascimento,
        usuario.sexo,
        usuario.email,
        usuario.telefone,
        usuario.celular,
        usuario.endereco,
        usuario.cep,
        usuario.bairro,
        usuario.nmcidade,
        usuario.uf,
        usuario.complemento,
        usuario.stusuario,
        usuario.dtcadastro AS dtcadastro_usuario,
        usuario.dtulogin,
        usuario.hrulogin
      FROM conveniado
      JOIN convenio ON convenio.idconvenio = conveniado.idconvenio
      LEFT JOIN usuario ON usuario.cpf = conveniado.cpf
      WHERE conveniado.idconvenio = $1
        AND conveniado.cpf = $2
      LIMIT 1
    `,
    [agreementId, memberId],
  );

  const row = result.rows[0];
  if (!row) {
    throw new PainelConvenioMembersError(
      "agreement_member_not_found",
      "Conveniado nao encontrado.",
      404,
    );
  }

  return {
    agreementId: Number(row.idconvenio),
    agreementName: row.nmconvenio,
    cpf: row.cpf,
    cpfLabel: formatCpf(row.cpf),
    userName: row.nmusuario,
    dailyPurchaseLimit: Number(row.qtcompradia ?? 0),
    startDate: formatDateLabel(row.dtiniado),
    endDate: formatDateLabel(row.dtfimado),
    statusCode: row.stconveniado,
    statusLabel: formatStatusLabel(row.stconveniado),
    createdAt: formatDateLabel(row.dtcadastro),
    userDocument: row.cpf,
    userRg: row.rg,
    birthDate: formatDateLabel(row.dtnascimento),
    genderLabel: formatGenderLabel(row.sexo),
    email: row.email,
    phone: row.telefone,
    mobile: row.celular,
    address: row.endereco,
    zipCode: row.cep,
    district: row.bairro,
    cityLabel:
      row.nmcidade && row.uf ? `${row.nmcidade} - ${row.uf}` : row.nmcidade,
    complement: row.complemento,
    userStatusLabel: formatStatusLabel(row.stusuario),
    userCreatedAt: formatDateLabel(row.dtcadastro_usuario),
    lastLoginLabel: formatLastLogin(row.dtulogin, row.hrulogin),
  } satisfies PainelConvenioMemberDetail;
}

export async function createPainelConvenioMember(input: {
  agreementId: unknown;
  values: PainelConvenioMemberFormValues;
}) {
  const values = validatePainelConvenioMemberForm(input.values);

  return createAgreementMember({
    agreementId: input.agreementId,
    values: {
      cpf: values.cpf,
      dailyPurchaseLimit: values.dailyPurchaseLimit,
      startDate: values.startDate,
      endDate: values.endDate,
      status: "ati",
    },
    reason: "Cadastro de conveniado pela tela legado do painel.",
  });
}

export async function updatePainelConvenioMember(input: {
  agreementId: unknown;
  memberId: unknown;
  values: PainelConvenioMemberFormValues & { status?: string | null };
}) {
  const values = validatePainelConvenioMemberForm(input.values);
  const normalizedStatus = normalizeStatus(input.values.status ?? "ati") ?? "ati";

  return updateAgreementMember({
    agreementId: input.agreementId,
    id: input.memberId,
    values: {
      cpf: values.cpf,
      dailyPurchaseLimit: values.dailyPurchaseLimit,
      startDate: values.startDate,
      endDate: values.endDate,
      status: normalizedStatus,
    },
    reason: "Edicao de conveniado pela tela legado do painel.",
  });
}

export async function togglePainelConvenioMemberStatus(input: {
  agreementId: unknown;
  memberId: unknown;
  status: unknown;
}) {
  const current = await getPainelConvenioMemberDetail({
    agreementId: input.agreementId,
    memberId: input.memberId,
  });
  const nextStatus = normalizeStatus(input.status);

  if (!nextStatus) {
    throw new PainelConvenioMembersError(
      "invalid_agreement_member_status",
      "Informe um status valido para o conveniado.",
      400,
    );
  }

  validateConveniadoActivation({
    status: nextStatus,
    endDate: current.endDate
      ? parseDate(current.endDate)
      : null,
  });

  return updateAgreementMember({
    agreementId: input.agreementId,
    id: current.cpf,
    values: {
      cpf: current.cpf,
      dailyPurchaseLimit: current.dailyPurchaseLimit,
      startDate: parseDate(current.startDate) ?? "",
      endDate: parseDate(current.endDate) ?? "",
      status: nextStatus,
    },
    reason: "Alternancia de status pela lista de conveniados.",
  });
}

export async function removePainelConvenioMember(input: {
  agreementId: unknown;
  memberId: unknown;
}) {
  return deleteAgreementMember({
    agreementId: input.agreementId,
    id: input.memberId,
    reason: "Exclusao de conveniado pela lista legado do painel.",
  });
}

export function asPainelConvenioMembersError(error: unknown) {
  const candidate = error as OpsAgreementMemberError;

  if (
    candidate &&
    typeof candidate === "object" &&
    typeof candidate.code === "string" &&
    typeof candidate.status === "number" &&
    typeof candidate.message === "string"
  ) {
    return new PainelConvenioMembersError(
      candidate.code,
      candidate.message,
      candidate.status,
    );
  }

  if (error instanceof PainelConvenioMembersError) {
    return error;
  }

  return new PainelConvenioMembersError(
    "agreement_member_unavailable",
    "Nao foi possivel concluir a operacao de conveniado agora.",
    500,
  );
}
