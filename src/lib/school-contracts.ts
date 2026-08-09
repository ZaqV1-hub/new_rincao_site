import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { queueLegacyEmail } from "@/lib/legacy-email";
import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";

type DbClientLike = {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount?: number }>;
};

type Actor = {
  name?: string | null;
  cpf?: string | null;
};

type SchoolRow = {
  idescola: number;
  nmescola: string;
  stescola: string | null;
  idcliente: number | null;
};

type RepresentativeRow = {
  idrepresentante: number;
  escola_id: number;
  nome: string;
  email: string;
};

type ContractRow = {
  idcontrato: number;
  escola_id: number;
  escola_nome: string;
  cliente_id: number | null;
  data_passeio: string;
  data_passeio_fmt: string;
  representante_id: number | null;
  representante_nome: string;
  representante_email: string;
  observacao: string | null;
  responsavel_nome: string;
  responsavel_telefone: string;
  responsavel_email: string;
  status: string;
  token: string;
  token_expira_em: string;
  token_usado_em: string | null;
  token_invalido_em: string | null;
  nome_confirmante: string | null;
  cargo_confirmante: string | null;
  confirmado_em: string | null;
  confirmado_em_fmt: string | null;
  ip_confirmacao: string | null;
  agenda_id: number | null;
  criado_em: string;
};

type AgendaRow = {
  idagenda: number;
};

export type SchoolContractOptions = {
  schools: Array<{
    id: number;
    name: string;
    clientId: number | null;
  }>;
  representatives: Array<{
    id: number;
    schoolId: number;
    name: string;
    email: string;
  }>;
};

export type CreateSchoolContractInput = {
  schoolId?: unknown;
  newSchoolName?: unknown;
  visitDate?: unknown;
  representativeId?: unknown;
  representativeName?: unknown;
  representativeEmail?: unknown;
  observation?: unknown;
  responsibleName?: unknown;
  responsiblePhone?: unknown;
  responsibleEmail?: unknown;
  baseUrl?: string | null;
  actor?: Actor | null;
};

export type ConfirmSchoolContractInput = {
  token?: unknown;
  confirmerName?: unknown;
  confirmerRole?: unknown;
  ipAddress?: string | null;
};

export type SchoolContractApproval = {
  token: string;
  status: "ready" | "expired" | "confirmed" | "invalidated";
  schoolName: string;
  visitDate: string;
  visitDateLabel: string;
  representativeName: string;
  representativeEmail: string;
  responsibleName: string;
  responsibleEmail: string;
  observation: string;
  terms: string;
  confirmedAt: string | null;
  confirmerName: string | null;
  confirmerRole: string | null;
};

export type CreateSchoolContractResult = {
  token: string;
  approvalPath: string;
  approvalUrl: string;
  message: string;
};

export class SchoolContractError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "SchoolContractError";
    this.code = code;
    this.status = status;
  }
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeMultiline(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function validateEmail(value: string, message: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new SchoolContractError("school_contract_invalid_email", message, 400);
  }

  return value;
}

function assertPositiveInteger(value: unknown, message: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new SchoolContractError("school_contract_invalid_input", message, 400);
  }

  return parsed;
}

function parseOptionalPositiveInteger(value: unknown) {
  const raw = normalizeText(value);

  if (!raw) {
    return null;
  }

  return assertPositiveInteger(raw, "Selecione um registro válido.");
}

function parseDateInput(value: unknown) {
  const raw = normalizeText(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new SchoolContractError(
      "school_contract_invalid_date",
      "Informe uma data válida para o passeio.",
      400,
    );
  }

  return raw;
}

function ensureTodayOrFuture(date: string) {
  const today = new Date();
  const todayIso = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  )
    .toISOString()
    .slice(0, 10);

  if (date < todayIso) {
    throw new SchoolContractError(
      "school_contract_invalid_date",
      "A data do passeio não pode ser anterior a hoje.",
      400,
    );
  }
}

function formatDateLabel(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function getContractTerms() {
  const configured = process.env.SCHOOL_CONTRACT_TERMS?.trim();

  if (configured) {
    return configured;
  }

  return [
    "A escola declara ciência da data agendada, das orientações operacionais e da responsabilidade pelos dados informados para o passeio escolar.",
    "A confirmação digital registra nome, cargo, data, horário e IP de quem confirmou o agendamento.",
    "Alterações posteriores de data, participantes ou condições devem ser tratadas diretamente com a equipe do Clube Rincão.",
  ].join("\n\n");
}

function getBaseUrl(inputUrl?: string | null) {
  const raw =
    inputUrl?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.SITE_BASE_URL?.trim() ||
    "http://localhost:3002";

  return raw.replace(/\/+$/, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildActorName(actor?: Actor | null) {
  return normalizeText(actor?.name) || normalizeText(actor?.cpf) || null;
}

function mapSchool(row: SchoolRow) {
  return {
    id: Number(row.idescola),
    name: row.nmescola,
    clientId: row.idcliente == null ? null : Number(row.idcliente),
  };
}

function mapRepresentative(row: RepresentativeRow) {
  return {
    id: Number(row.idrepresentante),
    schoolId: Number(row.escola_id),
    name: row.nome,
    email: row.email,
  };
}

function mapApproval(row: ContractRow): SchoolContractApproval {
  let status: SchoolContractApproval["status"] = "ready";

  if (row.status === "agendado") {
    status = "confirmed";
  } else if (row.token_usado_em || row.token_invalido_em) {
    status = "invalidated";
  } else if (new Date(row.token_expira_em).getTime() < Date.now()) {
    status = "expired";
  }

  return {
    token: row.token,
    status,
    schoolName: row.escola_nome,
    visitDate: row.data_passeio,
    visitDateLabel: row.data_passeio_fmt || formatDateLabel(row.data_passeio),
    representativeName: row.representante_nome,
    representativeEmail: row.representante_email,
    responsibleName: row.responsavel_nome,
    responsibleEmail: row.responsavel_email,
    observation: row.observacao ?? "",
    terms: getContractTerms(),
    confirmedAt: row.confirmado_em_fmt ?? row.confirmado_em,
    confirmerName: row.nome_confirmante,
    confirmerRole: row.cargo_confirmante,
  };
}

async function ensureContractTables(client: DbClientLike) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS contrato_escolar_representante (
      idrepresentante integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      escola_id integer NOT NULL REFERENCES escola(idescola),
      nome varchar(160) NOT NULL,
      email varchar(160) NOT NULL,
      ativo boolean NOT NULL DEFAULT true,
      criado_em timestamp without time zone NOT NULL DEFAULT now(),
      atualizado_em timestamp without time zone
    )
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_contrato_escolar_representante_email
    ON contrato_escolar_representante (escola_id, lower(email))
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS contrato_escolar_agendamento (
      idcontrato integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      escola_id integer NOT NULL REFERENCES escola(idescola),
      cliente_id integer REFERENCES clientes(idcliente),
      agenda_id integer REFERENCES agenda(idagenda),
      data_passeio date NOT NULL,
      representante_id integer REFERENCES contrato_escolar_representante(idrepresentante),
      representante_nome varchar(160) NOT NULL,
      representante_email varchar(160) NOT NULL,
      observacao text,
      responsavel_nome varchar(160) NOT NULL,
      responsavel_telefone varchar(40) NOT NULL,
      responsavel_email varchar(160) NOT NULL,
      status varchar(32) NOT NULL DEFAULT 'aguardando_confirmacao',
      nome_confirmante varchar(160),
      cargo_confirmante varchar(120),
      confirmado_em timestamp without time zone,
      ip_confirmacao varchar(80),
      token uuid NOT NULL UNIQUE,
      token_expira_em timestamp without time zone NOT NULL,
      token_usado_em timestamp without time zone,
      token_invalido_em timestamp without time zone,
      criado_por varchar(160),
      criado_em timestamp without time zone NOT NULL DEFAULT now(),
      atualizado_em timestamp without time zone
    )
  `);
}

async function getSchoolById(client: DbClientLike, schoolId: number) {
  const result = await client.query<SchoolRow>(
    `
      SELECT
        escola.idescola,
        escola.nmescola,
        escola.stescola,
        clientes.idcliente
      FROM escola
      LEFT JOIN clientes
        ON lower(btrim(clientes.nome)) = lower(btrim(escola.nmescola::text))
       AND clientes.idtipo = 4
      WHERE escola.idescola = $1
      LIMIT 1
    `,
    [schoolId],
  );
  const row = result.rows[0] ?? null;

  if (!row) {
    throw new SchoolContractError(
      "school_contract_school_not_found",
      "Escola não encontrada.",
      404,
    );
  }

  return row;
}

async function findClientIdForSchool(client: DbClientLike, schoolName: string) {
  const result = await client.query<{ idcliente: number }>(
    `
      SELECT idcliente
      FROM clientes
      WHERE idtipo = 4
        AND lower(btrim(nome)) = lower(btrim($1))
      LIMIT 1
    `,
    [schoolName],
  );

  return result.rows[0]?.idcliente ? Number(result.rows[0].idcliente) : null;
}

async function createSchool(client: DbClientLike, schoolName: string) {
  const result = await client.query<SchoolRow>(
    `
      INSERT INTO escola (
        nmescola,
        stescola,
        dtcadastro,
        hrcadastro
      )
      VALUES ($1, 'ati', CURRENT_DATE, CURRENT_TIME)
      RETURNING idescola, nmescola, stescola
    `,
    [schoolName],
  );
  const school = result.rows[0];

  const clientResult = await client.query<{ idcliente: number }>(
    `
      INSERT INTO clientes (
        idtipo,
        nome,
        status,
        criado_em
      )
      VALUES (4, $1, true, NOW())
      RETURNING idcliente
    `,
    [schoolName],
  );

  return {
    ...school,
    idcliente: clientResult.rows[0]?.idcliente ?? null,
  } satisfies SchoolRow;
}

async function getOrCreateRepresentative(
  client: DbClientLike,
  input: {
    schoolId: number;
    representativeId: number | null;
    name: string;
    email: string;
  },
) {
  if (input.representativeId) {
    const result = await client.query<RepresentativeRow>(
      `
        SELECT idrepresentante, escola_id, nome, email
        FROM contrato_escolar_representante
        WHERE idrepresentante = $1
          AND escola_id = $2
          AND ativo = true
        LIMIT 1
      `,
      [input.representativeId, input.schoolId],
    );
    const row = result.rows[0] ?? null;

    if (!row) {
      throw new SchoolContractError(
        "school_contract_representative_not_found",
        "Representante não encontrado para esta escola.",
        404,
      );
    }

    return row;
  }

  const name = normalizeText(input.name);
  const email = validateEmail(
    normalizeEmail(input.email),
    "Informe um e-mail válido para o representante.",
  );

  if (!name) {
    throw new SchoolContractError(
      "school_contract_invalid_representative",
      "Informe o nome do representante.",
      400,
    );
  }

  const result = await client.query<RepresentativeRow>(
    `
      INSERT INTO contrato_escolar_representante (
        escola_id,
        nome,
        email,
        ativo,
        criado_em
      )
      VALUES ($1, $2, $3, true, NOW())
      ON CONFLICT (escola_id, (lower(email)))
      DO UPDATE SET
        nome = EXCLUDED.nome,
        ativo = true,
        atualizado_em = NOW()
      RETURNING idrepresentante, escola_id, nome, email
    `,
    [input.schoolId, name, email],
  );

  return result.rows[0];
}

async function getContractByToken(client: DbClientLike, token: string) {
  const result = await client.query<ContractRow>(
    `
      SELECT
        contrato.idcontrato,
        contrato.escola_id,
        escola.nmescola AS escola_nome,
        contrato.cliente_id,
        to_char(contrato.data_passeio, 'YYYY-MM-DD') AS data_passeio,
        to_char(contrato.data_passeio, 'DD/MM/YYYY') AS data_passeio_fmt,
        contrato.representante_id,
        contrato.representante_nome,
        contrato.representante_email,
        contrato.observacao,
        contrato.responsavel_nome,
        contrato.responsavel_telefone,
        contrato.responsavel_email,
        contrato.status,
        contrato.token::text AS token,
        contrato.token_expira_em::text AS token_expira_em,
        contrato.token_usado_em::text AS token_usado_em,
        contrato.token_invalido_em::text AS token_invalido_em,
        contrato.nome_confirmante,
        contrato.cargo_confirmante,
        contrato.confirmado_em::text AS confirmado_em,
        to_char(contrato.confirmado_em, 'DD/MM/YYYY HH24:MI') AS confirmado_em_fmt,
        contrato.ip_confirmacao,
        contrato.agenda_id,
        contrato.criado_em::text AS criado_em
      FROM contrato_escolar_agendamento contrato
      JOIN escola ON escola.idescola = contrato.escola_id
      WHERE contrato.token = $1::uuid
      LIMIT 1
    `,
    [token],
  );

  return result.rows[0] ?? null;
}

async function ensureAgendaForDate(client: DbClientLike, visitDate: string) {
  const existing = await client.query<AgendaRow>(
    `
      SELECT idagenda
      FROM agenda
      WHERE dtagenda = $1
      LIMIT 1
    `,
    [visitDate],
  );

  if (existing.rows[0]) {
    return Number(existing.rows[0].idagenda);
  }

  const created = await client.query<AgendaRow>(
    `
      INSERT INTO agenda (
        dtagenda,
        tpagenda,
        stagenda,
        dtcadastro,
        hrcadastro
      )
      VALUES ($1, 'escol', 'abe', CURRENT_DATE, CURRENT_TIME)
      RETURNING idagenda
    `,
    [visitDate],
  );

  return Number(created.rows[0]?.idagenda ?? 0);
}

async function ensureSchoolTripBinding(
  client: DbClientLike,
  input: {
    schoolId: number;
    clientId: number | null;
    agendaId: number;
  },
) {
  const schoolTrip = await client.query<{ idescola: number }>(
    `
      SELECT idescola
      FROM escoladata
      WHERE idescola = $1
        AND idagenda = $2
      LIMIT 1
    `,
    [input.schoolId, input.agendaId],
  );

  if (!schoolTrip.rows[0]) {
    await client.query(
      `
        INSERT INTO escoladata (
          idescola,
          idagenda,
          status,
          dtcadastro,
          hrcadastro,
          codescoladata,
          permalink
        )
        VALUES ($1, $2, 'ati', CURRENT_DATE, CURRENT_TIME, $3, $4)
      `,
      [
        input.schoolId,
        input.agendaId,
        randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase(),
        randomUUID().replace(/-/g, "").slice(0, 12),
      ],
    );
  }

  if (!input.clientId) {
    return;
  }

  const extra = await client.query<{ idagenda: number }>(
    `
      SELECT idagenda
      FROM agenda_extras
      WHERE idagenda = $1
        AND idcliente = $2
      LIMIT 1
    `,
    [input.agendaId, input.clientId],
  );

  if (extra.rows[0]) {
    return;
  }

  await client.query(
    `
      INSERT INTO agenda_extras (
        idagenda,
        idcliente,
        aceita_familia,
        slug,
        criado_em,
        atualizado_em
      )
      VALUES ($1, $2, false, $3, NOW(), NOW())
    `,
    [input.agendaId, input.clientId, randomUUID().replace(/-/g, "")],
  );
}

async function sendContractInviteEmails(input: {
  approvalUrl: string;
  representativeName: string;
  representativeEmail: string;
  responsibleName: string;
  responsibleEmail: string;
  schoolName: string;
  visitDateLabel: string;
}) {
  const subject = `Confirmação de passeio escolar - ${input.schoolName}`;
  const html = `
    <p>Olá,</p>
    <p>clique no link abaixo para finalizar o agendamento do passeio escolar de <strong>${escapeHtml(input.schoolName)}</strong> em <strong>${escapeHtml(input.visitDateLabel)}</strong>.</p>
    <p><a href="${escapeHtml(input.approvalUrl)}">${escapeHtml(input.approvalUrl)}</a></p>
  `;

  const recipients = [
    {
      email: input.representativeEmail,
      name: input.representativeName,
    },
    {
      email: input.responsibleEmail,
      name: input.responsibleName,
    },
  ].filter(
    (recipient, index, list) =>
      recipient.email &&
      list.findIndex((item) => item.email === recipient.email) === index,
  );

  for (const recipient of recipients) {
    await queueLegacyEmail({
      to: recipient.email,
      toName: recipient.name,
      subject,
      html,
    });
  }
}

async function sendContractConfirmedEmails(input: {
  representativeName: string;
  representativeEmail: string;
  responsibleName: string;
  responsibleEmail: string;
  schoolName: string;
  visitDateLabel: string;
  confirmerName: string;
  confirmerRole: string;
}) {
  const subject = `Passeio agendado - ${input.schoolName}`;
  const html = `
    <p>O passeio escolar de <strong>${escapeHtml(input.schoolName)}</strong> foi agendado com sucesso para <strong>${escapeHtml(input.visitDateLabel)}</strong>.</p>
    <p>Confirmado por: ${escapeHtml(input.confirmerName)} - ${escapeHtml(input.confirmerRole)}.</p>
  `;
  const recipients = [
    {
      email: input.responsibleEmail,
      name: input.responsibleName,
    },
    {
      email: input.representativeEmail,
      name: input.representativeName,
    },
    {
      email: "financeiro@cluberincao.com.br",
      name: "Financeiro Clube Rincão",
    },
  ].filter(
    (recipient, index, list) =>
      recipient.email &&
      list.findIndex((item) => item.email === recipient.email) === index,
  );

  for (const recipient of recipients) {
    await queueLegacyEmail({
      to: recipient.email,
      toName: recipient.name,
      subject,
      html,
    });
  }
}

export async function getSchoolContractOptions(): Promise<SchoolContractOptions> {
  const pool = getIngressoSistemaDbPool();
  const client = await pool.connect();

  try {
    await ensureContractTables(client);

    const [schools, representatives] = await Promise.all([
      client.query<SchoolRow>(
        `
          SELECT
            escola.idescola,
            escola.nmescola,
            escola.stescola,
            clientes.idcliente
          FROM escola
          LEFT JOIN clientes
            ON lower(btrim(clientes.nome)) = lower(btrim(escola.nmescola::text))
           AND clientes.idtipo = 4
          WHERE lower(COALESCE(escola.stescola, 'ati')) <> 'ina'
          ORDER BY escola.nmescola ASC
          LIMIT 500
        `,
      ),
      client.query<RepresentativeRow>(
        `
          SELECT idrepresentante, escola_id, nome, email
          FROM contrato_escolar_representante
          WHERE ativo = true
          ORDER BY nome ASC
        `,
      ),
    ]);

    return {
      schools: schools.rows.map(mapSchool),
      representatives: representatives.rows.map(mapRepresentative),
    };
  } finally {
    client.release();
  }
}

export async function createSchoolContract(
  input: CreateSchoolContractInput,
): Promise<CreateSchoolContractResult> {
  const visitDate = parseDateInput(input.visitDate);
  const schoolId = parseOptionalPositiveInteger(input.schoolId);
  const newSchoolName = normalizeText(input.newSchoolName);
  const representativeId = parseOptionalPositiveInteger(input.representativeId);
  const responsibleName = normalizeText(input.responsibleName);
  const responsiblePhone = normalizeText(input.responsiblePhone);
  const responsibleEmail = validateEmail(
    normalizeEmail(input.responsibleEmail),
    "Informe um e-mail válido para o responsável.",
  );
  const observation = normalizeMultiline(input.observation);

  ensureTodayOrFuture(visitDate);

  if (!schoolId && !newSchoolName) {
    throw new SchoolContractError(
      "school_contract_invalid_school",
      "Selecione uma escola ou informe uma nova escola.",
      400,
    );
  }

  if (!responsibleName) {
    throw new SchoolContractError(
      "school_contract_invalid_responsible",
      "Informe o nome do responsável.",
      400,
    );
  }

  if (!responsiblePhone) {
    throw new SchoolContractError(
      "school_contract_invalid_responsible",
      "Informe o telefone do responsável.",
      400,
    );
  }

  const pool = getIngressoSistemaDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureContractTables(client);

    const school = schoolId
      ? await getSchoolById(client, schoolId)
      : await createSchool(client, newSchoolName);
    const clientId =
      school.idcliente == null
        ? await findClientIdForSchool(client, school.nmescola)
        : Number(school.idcliente);
    const representative = await getOrCreateRepresentative(client, {
      schoolId: Number(school.idescola),
      representativeId,
      name: normalizeText(input.representativeName),
      email: normalizeEmail(input.representativeEmail),
    });
    const token = randomUUID();

    await client.query(
      `
        UPDATE contrato_escolar_agendamento
        SET token_invalido_em = NOW(),
            atualizado_em = NOW()
        WHERE escola_id = $1
          AND data_passeio = $2
          AND status = 'aguardando_confirmacao'
          AND token_usado_em IS NULL
          AND token_invalido_em IS NULL
      `,
      [school.idescola, visitDate],
    );

    await client.query(
      `
        INSERT INTO contrato_escolar_agendamento (
          escola_id,
          cliente_id,
          data_passeio,
          representante_id,
          representante_nome,
          representante_email,
          observacao,
          responsavel_nome,
          responsavel_telefone,
          responsavel_email,
          status,
          token,
          token_expira_em,
          criado_por
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          'aguardando_confirmacao',
          $11::uuid,
          NOW() + (($12 || ' days')::interval),
          $13
        )
      `,
      [
        school.idescola,
        clientId,
        visitDate,
        representative.idrepresentante,
        representative.nome,
        representative.email,
        observation || null,
        responsibleName,
        responsiblePhone,
        responsibleEmail,
        token,
        Number(process.env.SCHOOL_CONTRACT_TOKEN_EXPIRATION_DAYS ?? 7),
        buildActorName(input.actor),
      ],
    );

    await client.query("COMMIT");

    const approvalPath = `/contrato/aprovacao/${token}`;
    const approvalUrl = `${getBaseUrl(input.baseUrl)}${approvalPath}`;

    await sendContractInviteEmails({
      approvalUrl,
      representativeName: representative.nome,
      representativeEmail: representative.email,
      responsibleName,
      responsibleEmail,
      schoolName: school.nmescola,
      visitDateLabel: formatDateLabel(visitDate),
    });

    return {
      token,
      approvalPath,
      approvalUrl,
      message: "E-mail enviado.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getSchoolContractApproval(
  tokenInput: unknown,
): Promise<SchoolContractApproval | null> {
  const token = normalizeText(tokenInput);

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
    return null;
  }

  const pool = getIngressoSistemaDbPool();
  const client = await pool.connect();

  try {
    await ensureContractTables(client);
    const row = await getContractByToken(client, token);
    return row ? mapApproval(row) : null;
  } finally {
    client.release();
  }
}

export async function confirmSchoolContract(input: ConfirmSchoolContractInput) {
  const token = normalizeText(input.token);
  const confirmerName = normalizeText(input.confirmerName);
  const confirmerRole = normalizeText(input.confirmerRole);

  if (!confirmerName || !confirmerRole) {
    throw new SchoolContractError(
      "school_contract_invalid_confirmer",
      "Informe nome e cargo de quem está confirmando.",
      400,
    );
  }

  const pool = getIngressoSistemaDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureContractTables(client);

    const row = await getContractByToken(client, token);

    if (!row) {
      throw new SchoolContractError(
        "school_contract_not_found",
        "Link de confirmação inválido.",
        404,
      );
    }

    const approval = mapApproval(row);

    if (approval.status === "expired") {
      throw new SchoolContractError(
        "school_contract_expired",
        "Este link expirou.",
        410,
      );
    }

    if (approval.status === "confirmed") {
      throw new SchoolContractError(
        "school_contract_already_confirmed",
        `Este passeio já foi confirmado em ${approval.confirmedAt ?? "data anterior"}.`,
        409,
      );
    }

    if (approval.status === "invalidated") {
      throw new SchoolContractError(
        "school_contract_invalidated",
        "Este link foi invalidado por um envio mais recente.",
        409,
      );
    }

    const agendaId = await ensureAgendaForDate(client, row.data_passeio);

    if (!agendaId) {
      throw new SchoolContractError(
        "school_contract_agenda_failed",
        "Não foi possível criar a agenda do passeio.",
        502,
      );
    }

    await ensureSchoolTripBinding(client, {
      schoolId: Number(row.escola_id),
      clientId: row.cliente_id == null ? null : Number(row.cliente_id),
      agendaId,
    });

    await client.query(
      `
        UPDATE contrato_escolar_agendamento
        SET status = 'agendado',
            agenda_id = $2,
            nome_confirmante = $3,
            cargo_confirmante = $4,
            confirmado_em = NOW(),
            ip_confirmacao = $5,
            token_usado_em = NOW(),
            atualizado_em = NOW()
        WHERE token = $1::uuid
      `,
      [
        token,
        agendaId,
        confirmerName,
        confirmerRole,
        normalizeText(input.ipAddress) || null,
      ],
    );

    await client.query("COMMIT");

    await sendContractConfirmedEmails({
      representativeName: row.representante_nome,
      representativeEmail: row.representante_email,
      responsibleName: row.responsavel_nome,
      responsibleEmail: row.responsavel_email,
      schoolName: row.escola_nome,
      visitDateLabel: row.data_passeio_fmt || formatDateLabel(row.data_passeio),
      confirmerName,
      confirmerRole,
    });

    return {
      token,
      agendaId,
      message: "Passeio agendado com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function asSchoolContractError(error: unknown) {
  if (error instanceof SchoolContractError) {
    return error;
  }

  return new SchoolContractError(
    "school_contract_failed",
    "Não foi possível concluir o fluxo de contrato escolar agora.",
    500,
  );
}

export async function getRequestIpAddress() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();

  return (
    forwardedFor ||
    headerStore.get("x-real-ip")?.trim() ||
    headerStore.get("cf-connecting-ip")?.trim() ||
    null
  );
}
