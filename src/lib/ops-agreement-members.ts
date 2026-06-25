import type { PoolClient } from "pg";
import { getIngressoDbPool } from "@/lib/ingresso-db";
import { registerOpsAuditLog } from "@/lib/ops-audit-log";

type AgreementMemberActor = {
  name?: string | null;
  cpf?: string | null;
};

type AgreementMemberValues = {
  cpf?: unknown;
  dailyPurchaseLimit?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  status?: unknown;
};

type AgreementMemberMutationInput = {
  agreementId?: unknown;
  id?: unknown;
  reason?: string | null;
  actor?: AgreementMemberActor | null;
  values?: AgreementMemberValues | null;
};

type AgreementMemberImportInput = {
  agreementId?: unknown;
  csvText?: string | null;
  reason?: string | null;
  actor?: AgreementMemberActor | null;
};

export type AgreementMemberListItem = {
  agreementId: number;
  agreementName: string | null;
  cpf: string;
  dailyPurchaseLimit: number;
  startDate: string | null;
  endDate: string | null;
  status: string | null;
  userName: string | null;
};

export type AgreementMemberListResult = {
  agreementId: number;
  agreementName: string | null;
  items: AgreementMemberListItem[];
  meta: {
    total: number;
    filters: {
      cpf: string | null;
      status: string | null;
      startDateFrom: string | null;
      startDateTo: string | null;
      endDateFrom: string | null;
      endDateTo: string | null;
    };
  };
};

export type AgreementMemberMutationResult = {
  agreementId: number;
  id: string;
  action: "create" | "update" | "delete";
  item: AgreementMemberListItem | null;
  auditLogId: number | null;
  message: string;
};

export type AgreementMemberImportPreviewRow = {
  line: number;
  cpf: string | null;
  dailyPurchaseLimit: number | null;
  startDate: string | null;
  endDate: string | null;
  status: "ati" | "ina" | null;
  errors: string[];
  willUpdate: boolean;
};

export type AgreementMemberImportPreviewResult = {
  agreementId: number;
  agreementName: string | null;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  log: string;
  rows: AgreementMemberImportPreviewRow[];
};

export type AgreementMemberImportApplyResult = {
  agreementId: number;
  agreementName: string | null;
  created: number;
  updated: number;
  skippedInvalid: number;
  auditLogId: number | null;
  log: string;
  message: string;
};

type AgreementMemberFilterInput = {
  agreementId?: unknown;
  cpf?: unknown;
  status?: unknown;
  startDateFrom?: unknown;
  startDateTo?: unknown;
  endDateFrom?: unknown;
  endDateTo?: unknown;
};

type AgreementRow = {
  idconvenio: number;
  nmconvenio: string | null;
};

type AgreementMemberRow = {
  idconvenio: number;
  nmconvenio: string | null;
  cpf: string;
  qtcompradia: number | string | null;
  dtiniado: string | null;
  dtfimado: string | null;
  stconveniado: string | null;
  nmusuario: string | null;
};

type ParsedAgreementMemberValues = {
  cpf: string;
  dailyPurchaseLimit: number;
  startDate: string;
  endDate: string;
  status: "ati" | "ina";
};

export class OpsAgreementMemberError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "OpsAgreementMemberError";
    this.code = code;
    this.status = status;
  }
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeCpf(value: unknown) {
  const digits = normalizeText(value).replace(/\D+/g, "");
  return digits.length === 11 ? digits : null;
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

function parsePositiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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

function normalizeActorName(actor: AgreementMemberActor | null | undefined) {
  return normalizeText(actor?.name) || normalizeText(actor?.cpf) || null;
}

function assertAgreementId(value: unknown) {
  const agreementId = Number(value);

  if (!Number.isInteger(agreementId) || agreementId <= 0) {
    throw new OpsAgreementMemberError(
      "invalid_agreement_id",
      "Informe um convenio valido.",
      400,
    );
  }

  return agreementId;
}

function assertMemberId(value: unknown) {
  const cpf = normalizeCpf(value);

  if (!cpf) {
    throw new OpsAgreementMemberError(
      "invalid_agreement_member_id",
      "Informe um CPF valido.",
      400,
    );
  }

  return cpf;
}

async function assertAgreementExists(client: PoolClient, agreementId: number) {
  const result = await client.query<AgreementRow>(
    `
      SELECT idconvenio, nmconvenio
      FROM convenio
      WHERE idconvenio = $1
      LIMIT 1
    `,
    [agreementId],
  );
  const agreement = result.rows[0] ?? null;

  if (!agreement) {
    throw new OpsAgreementMemberError(
      "agreement_not_found",
      "Convenio nao encontrado.",
      404,
    );
  }

  return agreement;
}

function toAgreementMemberItem(row: AgreementMemberRow): AgreementMemberListItem {
  return {
    agreementId: Number(row.idconvenio),
    agreementName: row.nmconvenio,
    cpf: row.cpf,
    dailyPurchaseLimit: Number(row.qtcompradia ?? 0),
    startDate: row.dtiniado ? String(row.dtiniado).slice(0, 10) : null,
    endDate: row.dtfimado ? String(row.dtfimado).slice(0, 10) : null,
    status: row.stconveniado,
    userName: row.nmusuario,
  };
}

async function getAgreementMember(
  client: PoolClient,
  agreementId: number,
  cpf: string,
) {
  const result = await client.query<AgreementMemberRow>(
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
      WHERE conveniado.idconvenio = $1
        AND conveniado.cpf = $2
      LIMIT 1
    `,
    [agreementId, cpf],
  );

  return result.rows[0] ? toAgreementMemberItem(result.rows[0]) : null;
}

async function assertAgreementMemberExists(
  client: PoolClient,
  agreementId: number,
  cpf: string,
) {
  const result = await client.query(
    `
      SELECT cpf
      FROM conveniado
      WHERE idconvenio = $1
        AND cpf = $2
      LIMIT 1
      FOR UPDATE
    `,
    [agreementId, cpf],
  );

  if (!result.rows[0]) {
    throw new OpsAgreementMemberError(
      "agreement_member_not_found",
      "Conveniado nao encontrado.",
      404,
    );
  }
}

function validateAgreementMemberValues(values: AgreementMemberValues | null | undefined) {
  const cpf = normalizeCpf(values?.cpf);
  const dailyPurchaseLimit = parsePositiveInteger(values?.dailyPurchaseLimit);
  const startDate = parseDate(values?.startDate);
  const endDate = parseDate(values?.endDate);
  const status = normalizeStatus(values?.status);

  if (!cpf) {
    throw new OpsAgreementMemberError(
      "invalid_agreement_member_payload",
      "Informe um CPF valido.",
      400,
    );
  }

  if (dailyPurchaseLimit === null) {
    throw new OpsAgreementMemberError(
      "invalid_agreement_member_payload",
      "Informe uma quantidade diaria valida.",
      400,
    );
  }

  if (!startDate) {
    throw new OpsAgreementMemberError(
      "invalid_agreement_member_payload",
      "Informe uma data inicial valida.",
      400,
    );
  }

  if (!endDate) {
    throw new OpsAgreementMemberError(
      "invalid_agreement_member_payload",
      "Informe uma data final valida.",
      400,
    );
  }

  if (endDate < startDate) {
    throw new OpsAgreementMemberError(
      "invalid_agreement_member_payload",
      "A data final deve ser igual ou posterior a data inicial.",
      400,
    );
  }

  if (!status) {
    throw new OpsAgreementMemberError(
      "invalid_agreement_member_payload",
      "Informe um status valido.",
      400,
    );
  }

  return {
    cpf,
    dailyPurchaseLimit,
    startDate,
    endDate,
    status,
  } satisfies ParsedAgreementMemberValues;
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function normalizeHeaderCell(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeImportRows(csvText: string) {
  const normalizedText = csvText.replace(/^\uFEFF/u, "").replace(/\r\n/g, "\n").trim();

  if (!normalizedText) {
    throw new OpsAgreementMemberError(
      "invalid_agreement_member_import",
      "Informe um CSV de conveniados.",
      400,
    );
  }

  const lines = normalizedText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new OpsAgreementMemberError(
      "invalid_agreement_member_import",
      "O CSV precisa ter cabecalho e ao menos uma linha de dados.",
      400,
    );
  }

  const header = parseCsvLine(lines[0]).map(normalizeHeaderCell);
  const expectedHeader = [
    "cpf",
    "qtd compra por dia",
    "data inicio",
    "data fim",
    "status",
  ];

  if (
    header.length < expectedHeader.length ||
    !expectedHeader.every((column, index) => header[index] === column)
  ) {
    throw new OpsAgreementMemberError(
      "invalid_agreement_member_import_header",
      "Cabecalho do CSV invalido para importacao de conveniados.",
      400,
    );
  }

  return lines.slice(1).map((line, index) => {
    const [cpf, dailyPurchaseLimit, startDate, endDate, status] = parseCsvLine(line);

    return {
      line: index + 2,
      cpf,
      dailyPurchaseLimit,
      startDate,
      endDate,
      status,
    };
  });
}

async function previewAgreementMembersImportInternal(
  client: PoolClient,
  agreementId: number,
  csvText: string,
) {
  const agreement = await assertAgreementExists(client, agreementId);
  const parsedRows = normalizeImportRows(csvText);
  const duplicateTracker = new Map<string, number>();

  for (const row of parsedRows) {
    const normalizedCpf = normalizeCpf(row.cpf);
    if (normalizedCpf) {
      duplicateTracker.set(normalizedCpf, (duplicateTracker.get(normalizedCpf) ?? 0) + 1);
    }
  }

  const distinctCpfs = Array.from(duplicateTracker.keys());
  const existingMembersResult =
    distinctCpfs.length > 0
      ? await client.query<{ cpf: string }>(
          `
            SELECT cpf
            FROM conveniado
            WHERE idconvenio = $1
              AND cpf = ANY($2::varchar[])
          `,
          [agreementId, distinctCpfs],
        )
      : { rows: [] };
  const existingCpfs = new Set(existingMembersResult.rows.map((row) => row.cpf));

  const rows = parsedRows.map<AgreementMemberImportPreviewRow>((row) => {
    const errors: string[] = [];
    const cpf = normalizeCpf(row.cpf);
    const dailyPurchaseLimit = parsePositiveInteger(row.dailyPurchaseLimit);
    const startDate = parseDate(row.startDate);
    const endDate = parseDate(row.endDate);
    const status = normalizeStatus(row.status);

    if (!cpf) {
      errors.push("CPF invalido.");
    }

    if (dailyPurchaseLimit === null) {
      errors.push("Quantidade diaria invalida.");
    }

    if (!startDate) {
      errors.push("Data inicial invalida.");
    }

    if (!endDate) {
      errors.push("Data final invalida.");
    }

    if (startDate && endDate && endDate < startDate) {
      errors.push("Data final anterior a data inicial.");
    }

    if (!status) {
      errors.push("Status invalido.");
    }

    if (cpf && (duplicateTracker.get(cpf) ?? 0) > 1) {
      errors.push("CPF duplicado no arquivo.");
    }

    return {
      line: row.line,
      cpf,
      dailyPurchaseLimit,
      startDate,
      endDate,
      status,
      errors,
      willUpdate: cpf ? existingCpfs.has(cpf) : false,
    };
  });

  const log = rows
    .filter((row) => row.errors.length > 0)
    .flatMap((row) => row.errors.map((error) => `Linha ${row.line}: ${error}`))
    .join("\n");

  return {
    agreementId,
    agreementName: agreement.nmconvenio,
    totalRows: rows.length,
    validRows: rows.filter((row) => row.errors.length === 0).length,
    invalidRows: rows.filter((row) => row.errors.length > 0).length,
    log,
    rows,
  } satisfies AgreementMemberImportPreviewResult;
}

export async function listAgreementMembers(filters: AgreementMemberFilterInput) {
  const agreementId = assertAgreementId(filters.agreementId);
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    const agreement = await assertAgreementExists(client, agreementId);
    const conditions = ["conveniado.idconvenio = $1"];
    const params: Array<string | number> = [agreementId];

    const cpf = normalizeCpf(filters.cpf);
    const status = normalizeStatus(filters.status);
    const startDateFrom = filters.startDateFrom ? parseDate(filters.startDateFrom) : null;
    const startDateTo = filters.startDateTo ? parseDate(filters.startDateTo) : null;
    const endDateFrom = filters.endDateFrom ? parseDate(filters.endDateFrom) : null;
    const endDateTo = filters.endDateTo ? parseDate(filters.endDateTo) : null;

    if (filters.cpf !== undefined && !cpf) {
      throw new OpsAgreementMemberError(
        "invalid_agreement_member_filter",
        "Informe um CPF valido para filtrar.",
        400,
      );
    }

    if (filters.status !== undefined && !status) {
      throw new OpsAgreementMemberError(
        "invalid_agreement_member_filter",
        "Informe um status valido para filtrar.",
        400,
      );
    }

    if (filters.startDateFrom !== undefined && !startDateFrom) {
      throw new OpsAgreementMemberError(
        "invalid_agreement_member_filter",
        "Informe uma data inicial de vigencia valida.",
        400,
      );
    }

    if (filters.startDateTo !== undefined && !startDateTo) {
      throw new OpsAgreementMemberError(
        "invalid_agreement_member_filter",
        "Informe uma data final de vigencia valida.",
        400,
      );
    }

    if (filters.endDateFrom !== undefined && !endDateFrom) {
      throw new OpsAgreementMemberError(
        "invalid_agreement_member_filter",
        "Informe uma data inicial de encerramento valida.",
        400,
      );
    }

    if (filters.endDateTo !== undefined && !endDateTo) {
      throw new OpsAgreementMemberError(
        "invalid_agreement_member_filter",
        "Informe uma data final de encerramento valida.",
        400,
      );
    }

    if (cpf) {
      params.push(cpf);
      conditions.push(`conveniado.cpf = $${params.length}`);
    }

    if (status) {
      params.push(status);
      conditions.push(`conveniado.stconveniado = $${params.length}`);
    }

    if (startDateFrom) {
      params.push(startDateFrom);
      conditions.push(`conveniado.dtiniado >= $${params.length}::date`);
    }

    if (startDateTo) {
      params.push(startDateTo);
      conditions.push(`conveniado.dtiniado <= $${params.length}::date`);
    }

    if (endDateFrom) {
      params.push(endDateFrom);
      conditions.push(`conveniado.dtfimado >= $${params.length}::date`);
    }

    if (endDateTo) {
      params.push(endDateTo);
      conditions.push(`conveniado.dtfimado <= $${params.length}::date`);
    }

    const result = await client.query<AgreementMemberRow>(
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
        WHERE ${conditions.join(" AND ")}
        ORDER BY conveniado.dtcadastro ASC NULLS LAST, conveniado.cpf ASC
        LIMIT 200
      `,
      params,
    );

    return {
      agreementId,
      agreementName: agreement.nmconvenio,
      items: result.rows.map(toAgreementMemberItem),
      meta: {
        total: result.rows.length,
        filters: {
          cpf: cpf ?? null,
          status: status ?? null,
          startDateFrom,
          startDateTo,
          endDateFrom,
          endDateTo,
        },
      },
    } satisfies AgreementMemberListResult;
  } finally {
    client.release();
  }
}

export async function createAgreementMember(input: AgreementMemberMutationInput) {
  const agreementId = assertAgreementId(input.agreementId);
  const values = validateAgreementMemberValues(input.values);
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const agreement = await assertAgreementExists(client, agreementId);
    const existing = await getAgreementMember(client, agreementId, values.cpf);

    if (existing) {
      throw new OpsAgreementMemberError(
        "agreement_member_already_exists",
        "Ja existe um conveniado cadastrado com este CPF neste convenio.",
        409,
      );
    }

    await client.query(
      `
        INSERT INTO conveniado (
          idconvenio,
          cpf,
          qtcompradia,
          dtiniado,
          dtfimado,
          stconveniado
        ) VALUES ($1, $2, $3, $4::date, $5::date, $6)
      `,
      [
        agreementId,
        values.cpf,
        values.dailyPurchaseLimit,
        values.startDate,
        values.endDate,
        values.status,
      ],
    );

    const item = await getAgreementMember(client, agreementId, values.cpf);
    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-admin",
      acao: "agreement_member_create",
      descricao: `Conveniado ${values.cpf} criado no convenio ${agreement.nmconvenio ?? agreementId}.`,
      motivo:
        normalizeText(input.reason) || "Cadastro de conveniado no painel interno",
      usuarioNome: normalizeActorName(input.actor),
      detalhes: {
        agreementId,
        cpf: values.cpf,
        after: item,
      },
    });

    await client.query("COMMIT");

    return {
      agreementId,
      id: values.cpf,
      action: "create",
      item,
      auditLogId,
      message: "Conveniado cadastrado com sucesso.",
    } satisfies AgreementMemberMutationResult;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateAgreementMember(input: AgreementMemberMutationInput) {
  const agreementId = assertAgreementId(input.agreementId);
  const originalCpf = assertMemberId(input.id);
  const values = validateAgreementMemberValues(input.values);
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const agreement = await assertAgreementExists(client, agreementId);
    await assertAgreementMemberExists(client, agreementId, originalCpf);

    if (values.cpf !== originalCpf) {
      const duplicate = await getAgreementMember(client, agreementId, values.cpf);

      if (duplicate) {
        throw new OpsAgreementMemberError(
          "agreement_member_already_exists",
          "Ja existe um conveniado cadastrado com este CPF neste convenio.",
          409,
        );
      }
    }

    await client.query(
      `
        UPDATE conveniado
        SET
          cpf = $3,
          qtcompradia = $4,
          dtiniado = $5::date,
          dtfimado = $6::date,
          stconveniado = $7
        WHERE idconvenio = $1
          AND cpf = $2
      `,
      [
        agreementId,
        originalCpf,
        values.cpf,
        values.dailyPurchaseLimit,
        values.startDate,
        values.endDate,
        values.status,
      ],
    );

    const item = await getAgreementMember(client, agreementId, values.cpf);
    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-admin",
      acao: "agreement_member_update",
      descricao:
        values.cpf === originalCpf
          ? `Conveniado ${originalCpf} alterado no convenio ${agreement.nmconvenio ?? agreementId}.`
          : `Conveniado ${originalCpf} alterado para ${values.cpf} no convenio ${agreement.nmconvenio ?? agreementId}.`,
      motivo: normalizeText(input.reason) || "Edicao de conveniado no painel interno",
      usuarioNome: normalizeActorName(input.actor),
      detalhes: {
        agreementId,
        cpf: values.cpf,
        previousCpf: values.cpf === originalCpf ? null : originalCpf,
        after: item,
      },
    });

    await client.query("COMMIT");

    return {
      agreementId,
      id: values.cpf,
      action: "update",
      item,
      auditLogId,
      message: "Conveniado alterado com sucesso.",
    } satisfies AgreementMemberMutationResult;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteAgreementMember(input: AgreementMemberMutationInput) {
  const agreementId = assertAgreementId(input.agreementId);
  const cpf = assertMemberId(input.id);
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const agreement = await assertAgreementExists(client, agreementId);
    await assertAgreementMemberExists(client, agreementId, cpf);
    const before = await getAgreementMember(client, agreementId, cpf);

    await client.query(
      `
        DELETE FROM conveniado
        WHERE idconvenio = $1
          AND cpf = $2
      `,
      [agreementId, cpf],
    );

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-admin",
      acao: "agreement_member_delete",
      descricao: `Conveniado ${cpf} removido do convenio ${agreement.nmconvenio ?? agreementId}.`,
      motivo:
        normalizeText(input.reason) || "Exclusao de conveniado no painel interno",
      usuarioNome: normalizeActorName(input.actor),
      detalhes: {
        agreementId,
        cpf,
        before,
      },
    });

    await client.query("COMMIT");

    return {
      agreementId,
      id: cpf,
      action: "delete",
      item: null,
      auditLogId,
      message: "Conveniado excluido com sucesso.",
    } satisfies AgreementMemberMutationResult;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function previewAgreementMembersImport(input: AgreementMemberImportInput) {
  const agreementId = assertAgreementId(input.agreementId);
  const csvText = normalizeText(input.csvText);
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    return await previewAgreementMembersImportInternal(client, agreementId, csvText);
  } finally {
    client.release();
  }
}

export async function applyAgreementMembersImport(input: AgreementMemberImportInput) {
  const agreementId = assertAgreementId(input.agreementId);
  const csvText = normalizeText(input.csvText);
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const preview = await previewAgreementMembersImportInternal(
      client,
      agreementId,
      csvText,
    );

    const validRows = preview.rows.filter((row) => row.errors.length === 0);

    if (validRows.length === 0) {
      throw new OpsAgreementMemberError(
        "invalid_agreement_member_import",
        "Nenhum conveniado valido encontrado para importar.",
        400,
      );
    }

    let created = 0;
    let updated = 0;

    for (const row of validRows) {
      const existing = await getAgreementMember(client, agreementId, row.cpf!);

      if (existing) {
        await client.query(
          `
            UPDATE conveniado
            SET
              qtcompradia = $3,
              dtiniado = $4::date,
              dtfimado = $5::date,
              stconveniado = $6
            WHERE idconvenio = $1
              AND cpf = $2
          `,
          [
            agreementId,
            row.cpf,
            row.dailyPurchaseLimit,
            row.startDate,
            row.endDate,
            row.status,
          ],
        );
        updated += 1;
      } else {
        await client.query(
          `
            INSERT INTO conveniado (
              idconvenio,
              cpf,
              qtcompradia,
              dtiniado,
              dtfimado,
              stconveniado
            ) VALUES ($1, $2, $3, $4::date, $5::date, $6)
          `,
          [
            agreementId,
            row.cpf,
            row.dailyPurchaseLimit,
            row.startDate,
            row.endDate,
            row.status,
          ],
        );
        created += 1;
      }
    }

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-admin",
      acao: "agreement_member_import_apply",
      descricao: `Importacao stateless de conveniados aplicada no convenio ${preview.agreementName ?? agreementId}.`,
      motivo:
        normalizeText(input.reason) || "Importacao de conveniados no painel interno",
      usuarioNome: normalizeActorName(input.actor),
      detalhes: {
        agreementId,
        created,
        updated,
        skippedInvalid: preview.invalidRows,
        rows: preview.rows,
      },
    });

    await client.query("COMMIT");

    return {
      agreementId,
      agreementName: preview.agreementName,
      created,
      updated,
      skippedInvalid: preview.invalidRows,
      auditLogId,
      log: preview.log,
      message: "Importacao de conveniados concluida com sucesso.",
    } satisfies AgreementMemberImportApplyResult;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function asOpsAgreementMemberError(error: unknown) {
  if (error instanceof OpsAgreementMemberError) {
    return error;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23503"
  ) {
    return new OpsAgreementMemberError(
      "agreement_member_in_use",
      "Nao e possivel excluir o conveniado: ha relacionamentos no sistema.",
      409,
    );
  }

  return new OpsAgreementMemberError(
    "agreement_member_unavailable",
    "Nao foi possivel concluir a operacao de conveniado agora.",
    502,
  );
}
