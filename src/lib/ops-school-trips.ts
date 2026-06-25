import { createHash, randomUUID } from "node:crypto";
import { getIngressoDbPool } from "@/lib/ingresso-db";
import { registerOpsAuditLog } from "@/lib/ops-audit-log";

type SchoolRow = {
  idescola: number;
  nmescola: string;
  stescola: string | null;
  idinformacao: number | null;
};

type SchoolTripRow = {
  idagenda: number;
  dtagenda: string;
  dtagenda_fmt: string;
  status: string | null;
  codescoladata: string | null;
  permalink: string | null;
};

type SchoolTripBindingRow = {
  idescola: number;
  idagenda: number;
  status: string | null;
};

type AgendaRow = {
  idagenda: number;
};

type DbClientLike = {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

type OpsActor = {
  name?: string | null;
  cpf?: string | null;
};

export type OpsSchoolTripsScreenInput = {
  schoolId?: unknown;
  query?: unknown;
};

export type OpsSchoolTripCreateInput = {
  schoolId?: unknown;
  visitDate?: unknown;
  actor?: OpsActor | null;
};

export type OpsSchoolTripUpdateStatusInput = {
  schoolId?: unknown;
  agendaId?: unknown;
  status?: unknown;
  actor?: OpsActor | null;
};

export type OpsSchoolTripDeleteInput = {
  schoolId?: unknown;
  agendaId?: unknown;
  reason?: unknown;
  actor?: OpsActor | null;
};

export type OpsSchoolTripsScreenData = {
  search: {
    query: string;
    results: Array<{
      schoolId: number;
      name: string;
      status: string;
      statusLabel: string;
    }>;
  };
  selectedSchool: null | {
    schoolId: number;
    name: string;
    status: string;
    statusLabel: string;
    informationId: number | null;
    trips: Array<{
      agendaId: number;
      date: string;
      dateLabel: string;
      status: string;
      statusLabel: string;
      code: string;
      permalink: string | null;
    }>;
  };
};

export type OpsSchoolTripMutationResult = {
  schoolId: number;
  agendaId: number;
  auditLogId: number | null;
  message: string;
};

export type OpsSchoolTripStatusMutationResult = OpsSchoolTripMutationResult & {
  status: string;
};

export class OpsSchoolTripsError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "OpsSchoolTripsError";
    this.code = code;
    this.status = status;
  }
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function assertPositiveInteger(value: unknown, message: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new OpsSchoolTripsError("ops_school_trip_invalid_input", message, 400);
  }

  return parsed;
}

function parseDateInput(value: unknown) {
  const raw = normalizeText(value);

  if (!raw) {
    throw new OpsSchoolTripsError(
      "ops_school_trip_invalid_date",
      "Informe a data do passeio.",
      400,
    );
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) {
    throw new OpsSchoolTripsError(
      "ops_school_trip_invalid_date",
      "Informe uma data valida para o passeio.",
      400,
    );
  }

  return `${match[3]}-${match[2]}-${match[1]}`;
}

function ensureTodayOrFuture(date: string) {
  const today = new Date();
  const todayIso = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10);

  if (date < todayIso) {
    throw new OpsSchoolTripsError(
      "ops_school_trip_invalid_date",
      "A data informada nao pode ser anterior a hoje.",
      400,
    );
  }
}

function buildActorName(actor?: OpsActor | null) {
  const name = normalizeText(actor?.name);
  const cpf = normalizeText(actor?.cpf);
  return name || cpf || null;
}

function formatSchoolStatusLabel(status: string | null | undefined) {
  return normalizeText(status).toLowerCase() === "ina" ? "Inativa" : "Ativa";
}

function buildSchoolTripCode() {
  return createHash("md5")
    .update(randomUUID())
    .digest("hex")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 6);
}

function buildPermalink() {
  return createHash("md5").update(randomUUID()).digest("hex").slice(0, 12);
}

async function getSchoolById(client: DbClientLike, schoolId: number) {
  const result = await client.query<SchoolRow>(
    `
      SELECT escola.idescola, escola.nmescola, escola.stescola, escola.idinformacao
      FROM escola
      WHERE escola.idescola = $1
      LIMIT 1
    `,
    [schoolId],
  );

  const school = result.rows[0] ?? null;

  if (!school) {
    throw new OpsSchoolTripsError(
      "ops_school_not_found",
      "Escola nao encontrada.",
      404,
    );
  }

  return school;
}

async function getSchoolTripBinding(
  client: DbClientLike,
  schoolId: number,
  agendaId: number,
) {
  const result = await client.query<SchoolTripBindingRow>(
    `
      SELECT idescola, idagenda, status
      FROM escoladata
      WHERE idescola = $1 AND idagenda = $2
      LIMIT 1
    `,
    [schoolId, agendaId],
  );

  const binding = result.rows[0] ?? null;

  if (!binding) {
    throw new OpsSchoolTripsError(
      "ops_school_trip_not_found",
      "Data de passeio escolar nao encontrada.",
      404,
    );
  }

  return binding;
}

export async function getOpsSchoolTripsScreenData(
  input: OpsSchoolTripsScreenInput,
): Promise<OpsSchoolTripsScreenData> {
  const pool = getIngressoDbPool();
  const client = await pool.connect();
  const query = normalizeText(input.query);
  const schoolId = normalizeText(input.schoolId)
    ? assertPositiveInteger(input.schoolId, "Informe uma escola valida.")
    : null;

  try {
    let selectedSchool: OpsSchoolTripsScreenData["selectedSchool"] = null;

    if (schoolId) {
      const school = await getSchoolById(client, schoolId);
      const tripsResult = await client.query<SchoolTripRow>(
        `
          SELECT
            escoladata.idagenda,
            to_char(agenda.dtagenda, 'YYYY-MM-DD') AS dtagenda,
            to_char(agenda.dtagenda, 'DD/MM/YYYY') AS dtagenda_fmt,
            escoladata.status,
            escoladata.codescoladata,
            escoladata.permalink
          FROM escoladata
          JOIN agenda ON agenda.idagenda = escoladata.idagenda
          WHERE escoladata.idescola = $1
          ORDER BY agenda.dtagenda DESC, escoladata.idagenda DESC
        `,
        [schoolId],
      );

      selectedSchool = {
        schoolId: school.idescola,
        name: school.nmescola,
        status: normalizeText(school.stescola).toLowerCase() || "ati",
        statusLabel: formatSchoolStatusLabel(school.stescola),
        informationId: school.idinformacao == null ? null : Number(school.idinformacao),
        trips: tripsResult.rows.map((row) => ({
          agendaId: Number(row.idagenda),
          date: row.dtagenda,
          dateLabel: row.dtagenda_fmt,
          status: normalizeText(row.status).toLowerCase() || "ati",
          statusLabel: formatSchoolStatusLabel(row.status),
          code: normalizeText(row.codescoladata) || String(row.idagenda),
          permalink: row.permalink,
        })),
      };
    }

    const searchResult =
      query.length >= 2
        ? await client.query<SchoolRow>(
            `
              SELECT escola.idescola, escola.nmescola, escola.stescola, escola.idinformacao
              FROM escola
              WHERE lower(escola.nmescola) LIKE lower($1)
              ORDER BY escola.nmescola ASC
              LIMIT 20
            `,
            [`%${query}%`],
          )
        : { rows: [] as SchoolRow[] };

    return {
      search: {
        query,
        results: searchResult.rows.map((row) => ({
          schoolId: Number(row.idescola),
          name: row.nmescola,
          status: normalizeText(row.stescola).toLowerCase() || "ati",
          statusLabel: formatSchoolStatusLabel(row.stescola),
        })),
      },
      selectedSchool,
    };
  } finally {
    client.release();
  }
}

export async function createOpsSchoolTripDate(
  input: OpsSchoolTripCreateInput,
): Promise<OpsSchoolTripMutationResult> {
  const schoolId = assertPositiveInteger(input.schoolId, "Informe uma escola valida.");
  const visitDate = parseDateInput(input.visitDate);
  ensureTodayOrFuture(visitDate);
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const school = await getSchoolById(client, schoolId);
    const agendaResult = await client.query<AgendaRow>(
      `
        SELECT agenda.idagenda
        FROM agenda
        WHERE agenda.dtagenda = $1
        LIMIT 1
      `,
      [visitDate],
    );

    let agendaId = Number(agendaResult.rows[0]?.idagenda ?? 0);

    if (!agendaId) {
      const insertAgendaResult = await client.query<AgendaRow>(
        `
          INSERT INTO agenda (dtagenda, tpagenda, stagenda)
          VALUES ($1, 'escol', 'abe')
          RETURNING idagenda
        `,
        [visitDate],
      );
      agendaId = Number(insertAgendaResult.rows[0]?.idagenda ?? 0);
    }

    const duplicateResult = await client.query<SchoolTripBindingRow>(
      `
        SELECT idescola, idagenda, status
        FROM escoladata
        WHERE idescola = $1 AND idagenda = $2
        LIMIT 1
      `,
      [schoolId, agendaId],
    );

    if (duplicateResult.rows[0]) {
      throw new OpsSchoolTripsError(
        "ops_school_trip_duplicate",
        "Data de passeio existente para esta escola.",
        409,
      );
    }

    await client.query(
      `
        INSERT INTO escoladata (
          idescola,
          idagenda,
          status,
          codescoladata,
          permalink
        ) VALUES ($1, $2, $3, $4, $5)
      `,
      [schoolId, agendaId, "ati", buildSchoolTripCode(), buildPermalink()],
    );

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-admin",
      acao: "school_trip_create",
      descricao: `Data ${visitDate} vinculada a escola ${school.nmescola}.`,
      motivo: "Vinculo de data de passeio escolar no painel interno",
      usuarioNome: buildActorName(input.actor),
      detalhes: {
        schoolId,
        agendaId,
        visitDate,
      },
    });

    await client.query("COMMIT");

    return {
      schoolId,
      agendaId,
      auditLogId,
      message: "Data de passeio vinculada com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOpsSchoolTripDateStatus(
  input: OpsSchoolTripUpdateStatusInput,
): Promise<OpsSchoolTripStatusMutationResult> {
  const schoolId = assertPositiveInteger(input.schoolId, "Informe uma escola valida.");
  const agendaId = assertPositiveInteger(input.agendaId, "Informe uma agenda valida.");
  const status = normalizeText(input.status).toLowerCase() === "ina" ? "ina" : "ati";
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await getSchoolTripBinding(client, schoolId, agendaId);
    await client.query(
      `
        UPDATE escoladata
        SET status = $1
        WHERE idescola = $2 AND idagenda = $3
      `,
      [status, schoolId, agendaId],
    );

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-admin",
      acao: "school_trip_status_update",
      descricao: `Status da data ${agendaId} da escola ${schoolId} alterado para ${status}.`,
      motivo: "Edicao de status de passeio escolar no painel interno",
      usuarioNome: buildActorName(input.actor),
      detalhes: {
        schoolId,
        agendaId,
        status,
      },
    });

    await client.query("COMMIT");

    return {
      schoolId,
      agendaId,
      status,
      auditLogId,
      message: "Status da data atualizado com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteOpsSchoolTripDate(
  input: OpsSchoolTripDeleteInput,
): Promise<OpsSchoolTripMutationResult> {
  const schoolId = assertPositiveInteger(input.schoolId, "Informe uma escola valida.");
  const agendaId = assertPositiveInteger(input.agendaId, "Informe uma agenda valida.");
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await getSchoolTripBinding(client, schoolId, agendaId);

    await client.query(
      `
        DELETE FROM escoladata
        WHERE idescola = $1 AND idagenda = $2
      `,
      [schoolId, agendaId],
    );

    const remainingBindings = await client.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM escoladata
        WHERE idagenda = $1
      `,
      [agendaId],
    );

    if (Number(remainingBindings.rows[0]?.total ?? 0) === 0) {
      const voucherResult = await client.query<{ total: string }>(
        `
          SELECT COUNT(*)::text AS total
          FROM voucher
          WHERE voucher.idagenda = $1
        `,
        [agendaId],
      );

      if (Number(voucherResult.rows[0]?.total ?? 0) > 0) {
        throw new OpsSchoolTripsError(
          "ops_school_trip_has_vouchers",
          "Esta data ja possui vouchers vinculados.",
          409,
        );
      }

      await client.query(
        `
          DELETE FROM agenda
          WHERE idagenda = $1
        `,
        [agendaId],
      );
    }

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-admin",
      acao: "school_trip_delete",
      descricao: `Data ${agendaId} removida da escola ${schoolId}.`,
      motivo: normalizeText(input.reason) || "Remocao de data de passeio escolar",
      usuarioNome: buildActorName(input.actor),
      detalhes: {
        schoolId,
        agendaId,
      },
    });

    await client.query("COMMIT");

    return {
      schoolId,
      agendaId,
      auditLogId,
      message: "Data de passeio removida com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function asOpsSchoolTripsError(error: unknown) {
  if (error instanceof OpsSchoolTripsError) {
    return error;
  }

  return new OpsSchoolTripsError(
    "ops_school_trips_failed",
    "Nao foi possivel concluir a operacao de passeio escolar agora.",
    500,
  );
}
