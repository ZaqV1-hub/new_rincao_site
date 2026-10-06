import { getIngressoSistemaDbDialect, getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import { sanitizeCpf } from "@/lib/cpf";
import type { QueryResultRow } from "pg";

export type EnfermariaSource = "cliente" | "day_use" | "sem_cadastro";
export type EnfermariaStatus = "aberto" | "encerrado";

export type EnfermariaLocal = {
  id: number;
  name: string;
  active: boolean;
  createdAt: string;
};

export type EnfermariaRecord = {
  id: number;
  numberLabel: string;
  status: EnfermariaStatus;
  source: EnfermariaSource;
  clientId: number | null;
  tripId: number | null;
  purchaseId: number | null;
  buyerCpf: string | null;
  localId: number | null;
  localName: string | null;
  professional: string;
  occurredAt: string;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string | null;
  closedBy: string | null;
  closedAt: string | null;
  editUnlocked: boolean;
  form: Record<string, unknown>;
};

type RawRecord = {
  id: number | string;
  status: string;
  source: string;
  client_id: number | string | null;
  trip_id: number | string | null;
  purchase_id: number | string | null;
  buyer_cpf: string | null;
  local_id: number | string | null;
  local_name: string | null;
  professional: string;
  occurred_at: string | Date;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
  closed_by: string | null;
  closed_at: string | null;
  edit_unlocked: boolean | number;
  form_json: string | Record<string, unknown>;
};

const tableReady = { postgres: false, mysql: false };
type EnfermariaDbClient = {
  query<T extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
  release(): void;
};

async function withEnfermariaTransaction<T>(operation: (client: EnfermariaDbClient) => Promise<T>) {
  const pool = getIngressoSistemaDbPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function dialect() {
  return getIngressoSistemaDbDialect();
}

function localDateTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")}`;
}

function recordDateTime(value: string | Date) {
  if (value instanceof Date) return localDateTime(value).slice(0, 16).replace(" ", "T");
  const direct = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  if (direct && !/[Z+]\d*$/.test(value)) return `${direct[1]}T${direct[2]}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value).replace(" ", "T").slice(0, 16) : localDateTime(parsed).slice(0, 16).replace(" ", "T");
}

async function ensureTables() {
  const currentDialect = dialect();
  if (tableReady[currentDialect]) return;
  const pool = getIngressoSistemaDbPool();

  if (currentDialect === "mysql") {
    await pool.query(`CREATE TABLE IF NOT EXISTS enfermaria_locais (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(160) NOT NULL,
      ativo TINYINT(1) NOT NULL DEFAULT 1,
      created_by VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(255) NULL,
      updated_at DATETIME NULL,
      UNIQUE KEY uq_enfermaria_local_nome (nome)
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS enfermaria_atendimentos (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      status VARCHAR(16) NOT NULL DEFAULT 'aberto',
      source VARCHAR(20) NOT NULL,
      client_id INT NULL,
      trip_id INT NULL,
      purchase_id INT NULL,
      buyer_cpf VARCHAR(20) NULL,
      local_id INT NULL,
      local_name VARCHAR(160) NULL,
      professional VARCHAR(255) NOT NULL,
      occurred_at DATETIME NOT NULL,
      created_by VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(255) NULL,
      updated_at DATETIME NULL,
      closed_by VARCHAR(255) NULL,
      closed_at DATETIME NULL,
      edit_unlocked TINYINT(1) NOT NULL DEFAULT 0,
      form_json LONGTEXT NOT NULL,
      KEY idx_enfermaria_status_occurred (status, occurred_at),
      KEY idx_enfermaria_client (client_id),
      KEY idx_enfermaria_buyer (buyer_cpf),
      KEY idx_enfermaria_purchase (purchase_id),
      KEY idx_enfermaria_local (local_id)
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS enfermaria_historico (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      atendimento_id INT NOT NULL,
      acao VARCHAR(40) NOT NULL,
      usuario VARCHAR(255) NOT NULL,
      detalhes_json LONGTEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_enfermaria_historico_atendimento (atendimento_id)
    )`);
    await pool.query(`INSERT IGNORE INTO enfermaria_locais (nome, created_by) VALUES
      ('Piscina de ondas', 'Sistema'), ('Piscina 1', 'Sistema'), ('Piscina 2', 'Sistema'),
      ('Salão principal', 'Sistema'), ('Salão colonial', 'Sistema')`);
  } else {
    await pool.query(`CREATE TABLE IF NOT EXISTS enfermaria_locais (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(160) NOT NULL UNIQUE,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by VARCHAR(255) NULL,
      updated_at TIMESTAMPTZ NULL
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS enfermaria_atendimentos (
      id SERIAL PRIMARY KEY,
      status VARCHAR(16) NOT NULL DEFAULT 'aberto',
      source VARCHAR(20) NOT NULL,
      client_id INTEGER NULL,
      trip_id INTEGER NULL,
      purchase_id INTEGER NULL,
      buyer_cpf VARCHAR(20) NULL,
      local_id INTEGER NULL,
      local_name VARCHAR(160) NULL,
      professional VARCHAR(255) NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL,
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by VARCHAR(255) NULL,
      updated_at TIMESTAMPTZ NULL,
      closed_by VARCHAR(255) NULL,
      closed_at TIMESTAMPTZ NULL,
      edit_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
      form_json TEXT NOT NULL
    )`);
    await pool.query("CREATE INDEX IF NOT EXISTS idx_enfermaria_status_occurred ON enfermaria_atendimentos (status, occurred_at DESC)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_enfermaria_client ON enfermaria_atendimentos (client_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_enfermaria_buyer ON enfermaria_atendimentos (buyer_cpf)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_enfermaria_purchase ON enfermaria_atendimentos (purchase_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_enfermaria_local ON enfermaria_atendimentos (local_id)");
    await pool.query(`CREATE TABLE IF NOT EXISTS enfermaria_historico (
      id SERIAL PRIMARY KEY,
      atendimento_id INTEGER NOT NULL,
      acao VARCHAR(40) NOT NULL,
      usuario VARCHAR(255) NOT NULL,
      detalhes_json TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query("CREATE INDEX IF NOT EXISTS idx_enfermaria_historico_atendimento ON enfermaria_historico (atendimento_id, created_at DESC)");
    await pool.query(`INSERT INTO enfermaria_locais (nome, created_by) VALUES
      ('Piscina de ondas', 'Sistema'), ('Piscina 1', 'Sistema'), ('Piscina 2', 'Sistema'),
      ('Salão principal', 'Sistema'), ('Salão colonial', 'Sistema')
      ON CONFLICT (nome) DO NOTHING`);
  }
  tableReady[currentDialect] = true;
}

function mapRecord(row: RawRecord): EnfermariaRecord {
  const rawForm = typeof row.form_json === "string" ? JSON.parse(row.form_json) : row.form_json;
  const occurredAt = recordDateTime(row.occurred_at).replace("T", " ");
  return {
    id: Number(row.id),
    numberLabel: String(row.id).padStart(4, "0"),
    status: row.status === "encerrado" ? "encerrado" : "aberto",
    source: row.source as EnfermariaSource,
    clientId: row.client_id == null ? null : Number(row.client_id),
    tripId: row.trip_id == null ? null : Number(row.trip_id),
    purchaseId: row.purchase_id == null ? null : Number(row.purchase_id),
    buyerCpf: row.buyer_cpf ? sanitizeCpf(row.buyer_cpf) : null,
    localId: row.local_id == null ? null : Number(row.local_id),
    localName: row.local_name,
    professional: row.professional,
    occurredAt,
    createdBy: row.created_by,
    createdAt: String(row.created_at),
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    closedBy: row.closed_by,
    closedAt: row.closed_at,
    editUnlocked: Boolean(row.edit_unlocked),
    form: rawForm && typeof rawForm === "object" ? rawForm : {},
  };
}

async function recordHistory(recordId: number, action: string, user: string, details?: unknown, client?: EnfermariaDbClient) {
  const sql = "INSERT INTO enfermaria_historico (atendimento_id, acao, usuario, detalhes_json) VALUES ($1, $2, $3, $4)";
  const values = [recordId, action, user, details == null ? null : JSON.stringify(details)];
  if (client) await client.query(sql, values);
  else await getIngressoSistemaDbPool().query(sql, values);
}

export async function listEnfermariaLocais(includeInactive = false): Promise<EnfermariaLocal[]> {
  await ensureTables();
  const pool = getIngressoSistemaDbPool();
  const activeWhere = dialect() === "mysql" ? "WHERE ativo = 1" : "WHERE ativo = TRUE";
  const result = await pool.query<Record<string, unknown>>(
    `SELECT id, nome, ativo, created_at FROM enfermaria_locais ${includeInactive ? "" : activeWhere} ORDER BY ativo DESC, nome ASC`,
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    name: String(row.nome),
    active: row.ativo === true || row.ativo === 1 || row.ativo === "1" || row.ativo === "t",
    createdAt: String(row.created_at),
  }));
}

export async function saveEnfermariaLocal(input: { id?: number; name: string; active?: boolean; actor: string }) {
  await ensureTables();
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name || name.length > 160) throw new Error("Informe um nome de local com até 160 caracteres.");
  const pool = getIngressoSistemaDbPool();
  if (input.id) {
    await pool.query("UPDATE enfermaria_locais SET nome = $2, ativo = $3, updated_by = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [input.id, name, input.active !== false, input.actor]);
    return input.id;
  }
  const result = await pool.query<{ id: number | string }>(
    dialect() === "mysql"
      ? "INSERT INTO enfermaria_locais (nome, created_by) VALUES ($1, $2) RETURNING id"
      : "INSERT INTO enfermaria_locais (nome, created_by) VALUES ($1, $2) RETURNING id",
    [name, input.actor],
  );
  const id = Number(result.rows[0]?.id ?? 0);
  return id;
}

export async function searchEnfermariaClients(query: string) {
  await ensureTables();
  const value = query.trim();
  if (value.length < 2) return [];
  const pool = getIngressoSistemaDbPool();
  const result = await pool.query<Record<string, unknown>>(
    `SELECT c.idcliente, c.nome, c.endereco,
      EXISTS (
        SELECT 1 FROM escola e
        JOIN escoladata ed ON ed.idescola = e.idescola
        JOIN agenda a ON a.idagenda = ed.idagenda
        WHERE lower(btrim(e.nmescola)) = lower(btrim(c.nome))
          AND DATE(a.dtagenda) = CURRENT_DATE
          AND lower(COALESCE(ed.status, 'ati')) NOT IN ('ina', 'encerrado')
      ) AS passeio_hoje
      FROM clientes c
      WHERE lower(c.nome) LIKE lower($1)
      ORDER BY c.nome ASC LIMIT 15`,
    [`%${value}%`],
  );
  return result.rows.map((row) => ({
    id: Number(row.idcliente), name: String(row.nome), address: String(row.endereco ?? ""),
    hasTripToday: row.passeio_hoje === true || row.passeio_hoje === 1 || row.passeio_hoje === "t",
  }));
}

export async function listEnfermariaClientTrips(clientId: number) {
  await ensureTables();
  const pool = getIngressoSistemaDbPool();
  const result = await pool.query<Record<string, unknown>>(
    `SELECT ed.idagenda, a.dtagenda, ed.status, e.nmescola
     FROM clientes c JOIN escola e ON lower(btrim(e.nmescola)) = lower(btrim(c.nome))
     JOIN escoladata ed ON ed.idescola = e.idescola JOIN agenda a ON a.idagenda = ed.idagenda
     WHERE c.idcliente = $1 ORDER BY a.dtagenda DESC LIMIT 100`, [clientId],
  );
  return result.rows.map((row) => ({ id: Number(row.idagenda), date: String(row.dtagenda).slice(0, 10), status: String(row.status ?? "ati") }));
}

export async function searchEnfermariaDayUse(cpfValue: string) {
  const cpf = sanitizeCpf(cpfValue);
  if (cpf.length !== 11) return [];
  await ensureTables();
  const pool = getIngressoSistemaDbPool();
  const ticketList = dialect() === "mysql"
    ? "GROUP_CONCAT(DISTINCT COALESCE(voucher.descricao, voucher.tpvoucher) SEPARATOR ', ')"
    : "STRING_AGG(DISTINCT COALESCE(voucher.descricao, voucher.tpvoucher), ', ')";
  const result = await pool.query<Record<string, unknown>>(
    `SELECT compra.idcompra, compra.stcompra, compra.cpf, usuario.nmusuario,
       MIN(agenda.dtagenda) AS dtagenda, COUNT(voucher.idvoucher) AS quantidade,
       ${ticketList} AS ingressos
     FROM compra JOIN voucher ON voucher.idcompra = compra.idcompra
     JOIN agenda ON agenda.idagenda = voucher.idagenda
     LEFT JOIN usuario ON usuario.cpf = compra.cpf
     WHERE compra.cpf = $1 AND COALESCE(agenda.tpagenda, '') <> 'escol'
     GROUP BY compra.idcompra, compra.stcompra, compra.cpf, usuario.nmusuario
     ORDER BY MIN(agenda.dtagenda) DESC LIMIT 15`, [cpf],
  );
  return result.rows.map((row) => ({
    id: Number(row.idcompra), status: String(row.stcompra ?? ""), cpf: sanitizeCpf(String(row.cpf)),
    buyerName: String(row.nmusuario ?? "Comprador"), visitDate: String(row.dtagenda ?? "").slice(0, 10),
    ticketCount: Number(row.quantidade ?? 0), tickets: String(row.ingressos ?? "Ingressos"),
  }));
}

export async function createEnfermariaRecord(input: {
  source: EnfermariaSource; clientId?: number | null; tripId?: number | null; purchaseId?: number | null;
  buyerCpf?: string | null; initialName?: string; clientName?: string; buyerName?: string; visitDate?: string; ticketCount?: number; ticketSummary?: string; professional: string; actor: string; occurredAt: string;
  intakeSource?: string; guardianCpf?: string; guardianPhone?: string; noAccountReason?: string;
}) {
  await ensureTables();
  const pool = getIngressoSistemaDbPool();
  let clientName = "";
  let buyerName = "";
  let visitDate = "";
  let ticketCount = 0;
  let ticketSummary = "";
  if (input.source === "cliente") {
    if (!input.clientId || !input.tripId) throw new Error("Selecione um cliente e o passeio correspondente.");
    const link = await pool.query<{ nome: string }>(
      `SELECT c.nome FROM clientes c JOIN escola e ON lower(btrim(e.nmescola)) = lower(btrim(c.nome))
       JOIN escoladata ed ON ed.idescola = e.idescola
       WHERE c.idcliente = $1 AND ed.idagenda = $2 LIMIT 1`, [input.clientId, input.tripId],
    );
    if (!link.rows[0]) throw new Error("O passeio selecionado não pertence a este cliente.");
    clientName = link.rows[0].nome;
  } else if (input.source === "day_use") {
    if (!input.purchaseId || !input.buyerCpf) throw new Error("Localize uma compra de day use válida pelo CPF do comprador.");
    const purchase = (await searchEnfermariaDayUse(input.buyerCpf)).find((item) => item.id === input.purchaseId);
    if (!purchase) throw new Error("A compra não corresponde ao CPF ou não é de day use.");
    buyerName = purchase.buyerName;
    visitDate = purchase.visitDate;
    ticketCount = purchase.ticketCount;
    ticketSummary = purchase.tickets;
  }
  const intakeSources = ["", "Grupo misto", "Igreja", "Excursão", "Empresa", "Bilheteria presencial", "Cortesia", "Convidado ou fornecedor", "Outro"];
  if (input.source === "sem_cadastro") {
    const name = input.initialName?.trim() ?? "";
    const guardianCpf = sanitizeCpf(input.guardianCpf ?? "");
    if (!name || name.length > 200 || !intakeSources.includes(input.intakeSource ?? "")) {
      throw new Error("Informe quem é a pessoa ou o grupo (até 200 caracteres) e uma origem válida.");
    }
    if (guardianCpf && guardianCpf.length !== 11) throw new Error("Confira o CPF do responsável.");
    if ((input.guardianPhone ?? "").length > 40 || (input.noAccountReason ?? "").length > 2000) {
      throw new Error("Confira o telefone e o motivo do registro sem cadastro.");
    }
  }
  const form = input.source === "sem_cadastro" ? {
    identification: { name: input.initialName ?? "" },
    unregisteredDetails: {
      intakeSource: input.intakeSource ?? "",
      guardianCpf: input.guardianCpf ?? "",
      guardianPhone: input.guardianPhone ?? "",
      noAccountReason: input.noAccountReason ?? "",
    },
  } : { context: { clientName, buyerName, visitDate, ticketCount, ticketSummary } };
  const id = await withEnfermariaTransaction(async (client) => {
    const result = await client.query<{ id: number | string }>(
      `INSERT INTO enfermaria_atendimentos
        (status, source, client_id, trip_id, purchase_id, buyer_cpf, professional, occurred_at, created_by, form_json)
       VALUES ('aberto', $1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [input.source, input.clientId ?? null, input.tripId ?? null, input.purchaseId ?? null,
        input.buyerCpf ? sanitizeCpf(input.buyerCpf) : null, input.professional,
        dialect() === "mysql" ? localDateTime(new Date(input.occurredAt)) : input.occurredAt,
        input.actor, JSON.stringify(form)],
    );
    const recordId = Number(result.rows[0]?.id ?? 0);
    await recordHistory(recordId, "criacao", input.actor, { source: input.source }, client);
    return recordId;
  });
  return id;
}

export async function getEnfermariaRecord(id: number): Promise<EnfermariaRecord | null> {
  await ensureTables();
  const pool = getIngressoSistemaDbPool();
  const result = await pool.query<RawRecord>("SELECT * FROM enfermaria_atendimentos WHERE id = $1 LIMIT 1", [id]);
  return result.rows[0] ? mapRecord(result.rows[0]) : null;
}

export async function listEnfermariaRecords(filters: Record<string, string | null> = {}) {
  await ensureTables();
  const pool = getIngressoSistemaDbPool();
  const conditions: string[] = [];
  const values: unknown[] = [];
  const add = (sql: string, value: unknown) => { values.push(value); conditions.push(sql.replace("?", `$${values.length}`)); };
  if (filters.status && filters.status !== "todos") add("status = ?", filters.status);
  if (filters.source && filters.source !== "todos") add("source = ?", filters.source);
  if (filters.clientId) add("client_id = ?", Number(filters.clientId));
  if (filters.cpf) {
    values.push(sanitizeCpf(filters.cpf));
    const cpfPlaceholder = `$${values.length}`;
    values.push(`%${sanitizeCpf(filters.cpf)}%`);
    conditions.push(`(buyer_cpf = ${cpfPlaceholder} OR form_json LIKE $${values.length})`);
  }
  if (filters.demand) add("form_json LIKE ?", `%${filters.demand}%`);
  if (filters.professional) add("lower(professional) LIKE lower(?)", `%${filters.professional}%`);
  if (filters.q) add("form_json LIKE ?", `%${filters.q}%`);
  if (filters.localId) add("local_id = ?", Number(filters.localId));
  if (filters.upa === "sim") conditions.push("COALESCE(form_json, '') LIKE '%\"referralToUpa\":true%'");
  if (filters.upa === "nao") conditions.push("COALESCE(form_json, '') NOT LIKE '%\"referralToUpa\":true%'");
  if (filters.alert === "sim") conditions.push("COALESCE(form_json, '') LIKE '%\"urgent\":true%'");
  if (filters.from) add("occurred_at >= ?", dialect() === "mysql" ? `${filters.from} 00:00:00` : `${filters.from}T00:00:00-03:00`);
  if (filters.to) add("occurred_at <= ?", dialect() === "mysql" ? `${filters.to} 23:59:59` : `${filters.to}T23:59:59-03:00`);
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await pool.query<RawRecord>(`SELECT * FROM enfermaria_atendimentos ${where} ORDER BY occurred_at DESC, id DESC LIMIT 500`, values);
  return result.rows.map(mapRecord);
}

export async function updateEnfermariaRecord(id: number, input: {
  form: Record<string, unknown>; occurredAt: string; localId: number | null; actor: string;
}) {
  await ensureTables();
  const existing = await getEnfermariaRecord(id);
  if (!existing) throw new Error("Atendimento não encontrado.");
  if (existing.status === "encerrado" && !existing.editUnlocked) throw new Error("A ficha encerrada está bloqueada. Um gerente precisa liberar a edição.");
  const pool = getIngressoSistemaDbPool();
  let localName: string | null = null;
  if (input.localId) {
    const localResult = await pool.query<{ nome: string; ativo: boolean | number | string }>("SELECT nome, ativo FROM enfermaria_locais WHERE id = $1 LIMIT 1", [input.localId]);
    const local = localResult.rows[0];
    if (!local) throw new Error("O local selecionado não existe.");
    const isActive = local.ativo === true || local.ativo === 1 || local.ativo === "1" || local.ativo === "t";
    if (!isActive && existing.localId !== input.localId) throw new Error("Selecione um local ativo.");
    localName = local.nome;
  }
  await withEnfermariaTransaction(async (client) => {
    await client.query(
      "UPDATE enfermaria_atendimentos SET form_json = $2, occurred_at = $3, local_id = $4, local_name = $5, updated_by = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [id, JSON.stringify(input.form), dialect() === "mysql" ? localDateTime(new Date(input.occurredAt)) : input.occurredAt, input.localId, localName, input.actor],
    );
    await recordHistory(id, "edicao", input.actor, { status: existing.status }, client);
  });
  return getEnfermariaRecord(id);
}

export async function closeEnfermariaRecord(id: number, actor: string) {
  const existing = await getEnfermariaRecord(id);
  if (!existing) throw new Error("Atendimento não encontrado.");
  if (existing.status === "encerrado" && !existing.editUnlocked) return existing;
  await withEnfermariaTransaction(async (client) => {
    await client.query("UPDATE enfermaria_atendimentos SET status = 'encerrado', closed_by = $2, closed_at = CURRENT_TIMESTAMP, edit_unlocked = FALSE, updated_by = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id, actor]);
    await recordHistory(id, "encerramento", actor, undefined, client);
  });
  return getEnfermariaRecord(id);
}

export async function unlockEnfermariaRecord(id: number, actor: string) {
  const existing = await getEnfermariaRecord(id);
  if (!existing || existing.status !== "encerrado") throw new Error("Somente fichas encerradas podem ser liberadas.");
  await withEnfermariaTransaction(async (client) => {
    await client.query("UPDATE enfermaria_atendimentos SET edit_unlocked = TRUE, updated_by = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id, actor]);
    await recordHistory(id, "liberacao_edicao", actor, undefined, client);
  });
  return getEnfermariaRecord(id);
}

export async function linkEnfermariaClient(id: number, clientId: number, actor: string) {
  const pool = getIngressoSistemaDbPool();
  const record = await getEnfermariaRecord(id);
  if (!record || record.source !== "sem_cadastro") throw new Error("Somente atendimentos sem cadastro podem ser vinculados.");
  const client = await pool.query<{ nome: string }>("SELECT nome FROM clientes WHERE idcliente = $1 LIMIT 1", [clientId]);
  if (!client.rows[0]) throw new Error("Cliente não encontrado.");
  await withEnfermariaTransaction(async (db) => {
    await db.query("UPDATE enfermaria_atendimentos SET client_id = $2, updated_by = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id, clientId, actor]);
    await recordHistory(id, "vinculo_cliente", actor, { clientId, clientName: client.rows[0].nome }, db);
  });
  return getEnfermariaRecord(id);
}

export async function listEnfermariaHistory(id: number) {
  await ensureTables();
  const pool = getIngressoSistemaDbPool();
  const result = await pool.query<Record<string, unknown>>("SELECT acao, usuario, detalhes_json, created_at FROM enfermaria_historico WHERE atendimento_id = $1 ORDER BY created_at DESC, id DESC", [id]);
  return result.rows.map((row) => ({
    action: String(row.acao), user: String(row.usuario), details: typeof row.detalhes_json === "string" ? JSON.parse(row.detalhes_json) : row.detalhes_json,
    at: String(row.created_at),
  }));
}

export async function listEnfermariaDashboard(from: string, to: string) {
  const records = await listEnfermariaRecords({ from, to });
  const demandCounts = new Map<string, number>();
  const localCounts = new Map<string, number>();
  const timeCounts = new Map<string, number>();
  const timeline = new Map<string, number>();
  let urgent = 0;
  let upa = 0;
  for (const record of records) {
    const data = record.form as { demandTypes?: string[]; urgent?: boolean; referralToUpa?: boolean };
    if (data.urgent) urgent++;
    if (data.referralToUpa) upa++;
    const complaint = record.form.complaint as { demandTypes?: string[] } | undefined;
    for (const type of complaint?.demandTypes ?? []) demandCounts.set(type, (demandCounts.get(type) ?? 0) + 1);
    const place = record.localName ?? "Sem local";
    localCounts.set(place, (localCounts.get(place) ?? 0) + 1);
    const hour = Number(record.occurredAt.slice(11, 13));
    const slot = hour < 12 ? "9h às 12h" : hour < 15 ? "12h às 15h" : "15h às 18h";
    timeCounts.set(slot, (timeCounts.get(slot) ?? 0) + 1);
    const day = record.occurredAt.slice(0, 10);
    timeline.set(day, (timeline.get(day) ?? 0) + 1);
  }
  return { records, totals: { count: records.length, open: records.filter((r) => r.status === "aberto").length, upa, urgent }, demandCounts: Object.fromEntries(demandCounts), localCounts: Object.fromEntries(localCounts), timeCounts: Object.fromEntries(timeCounts), timeline: Object.fromEntries(timeline) };
}

export async function verifyEnfermariaManagerPassword(cpf: string, password: string) {
  const pool = getIngressoSistemaDbPool();
  const normalizedCpf = sanitizeCpf(cpf);
  const result = await pool.query<{ idpapel: number; stusuario: string }>("SELECT idpapel, stusuario FROM usuario WHERE cpf = $1 LIMIT 1", [normalizedCpf]);
  if (Number(result.rows[0]?.idpapel) !== 1 || result.rows[0]?.stusuario === "ina") return false;
  const { authenticatePanelUser } = await import("@/lib/user-repository");
  const user = await authenticatePanelUser(normalizedCpf, password);
  return user?.roleId === 1;
}

export async function addEnfermariaClientObservation(clientId: number, observation: string, actor: string) {
  const safeText = observation.trim();
  if (!/^Passou pela enfermaria em \d{2}\/\d{2}\/\d{4}(?:\. Oferecer cortesia na próxima visita\.)?$/.test(safeText)) {
    throw new Error("Use uma observação padrão neutra: ‘Passou pela enfermaria em DD/MM/AAAA.’");
  }
  const { addClientObservation } = await import("@/lib/client-observations");
  await addClientObservation({ clientId, text: safeText, actorName: actor });
}

export async function auditEnfermariaAction(id: number, action: string, actor: string) {
  await recordHistory(id, action, actor);
}
