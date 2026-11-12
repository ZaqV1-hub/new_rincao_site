import { getOnlineCapacityOccupied } from "@/lib/online-capacity";
import { lockOperationalDay } from "@/lib/operational-day-lock";
export { lockOperationalDay } from "@/lib/operational-day-lock";
import type { PoolClient } from "pg";
import { getOperationalParkId, type OperationalParkId } from "@/lib/operational-day-contract";
import { getSaoPauloToday, isCivilDate, type OperationalValidity } from "@/lib/operational-date";
import { registerOpsAuditLog } from "@/lib/ops-audit-log";
import { catalogId, getOperationalCatalogPool, withOperationalCatalogTransaction, type CatalogActor } from "@/lib/painel-operational-catalog";

export type OperationalTicketType = "norma" | "infan" | "isent";
export type OperationalDay = {
  date: string;
  version: number | null;
  priceTableId: number | null;
  dayUseAgendaId: number | null;
  dayUseOpen: boolean;
  onlineSoldOut?: boolean;
  validity: OperationalValidity;
  onlineLimit: number | null;
  ticketTypes: OperationalTicketType[];
  serviceIds: number[];
  closed: boolean;
};
export type OperationalDayInput = Omit<OperationalDay, "dayUseAgendaId" | "closed" | "priceTableId" | "onlineSoldOut"> & { priceTableId: number; reason: string };
export type ApplyOperationalPriceTableInput = {
  dates: { date: string; version: number | null }[];
  priceTableId: number;
  reason: string;
};
export class OperationalDayError extends Error {
  constructor(readonly code: "invalid_input" | "version_conflict" | "day_closed" | "ambiguous_agenda", message: string) {
    super(message);
  }
}

type QueryClient = Pick<PoolClient, "query">;
type ConfigRow = Omit<OperationalDay, "dayUseOpen" | "serviceIds">;
const configColumns = `data::text AS date, versao AS version, tabela_preco_id AS "priceTableId",
  day_use_agenda_id AS "dayUseAgendaId", validade AS validity, limite_online AS "onlineLimit",
  tipos_ingresso AS "ticketTypes", estado = 'closed' AS closed`;

function invalid(message = "Dados da programação inválidos."): never {
  throw new OperationalDayError("invalid_input", message);
}
function record(input: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => !keys.includes(key))) invalid();
  return input as Record<string, unknown>;
}
function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function readDate(value: unknown, future = false): string {
  if (!isCivilDate(value)) invalid("Informe uma data válida no formato AAAA-MM-DD.");
  if (future && value < getSaoPauloToday()) invalid("Datas passadas não podem ser alteradas.");
  return value;
}
function readVersion(value: unknown): number | null {
  if (value !== null && (!positive(value) || value > 2147483647)) invalid("Informe a versão atual da programação.");
  return value;
}
function readReason(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 1000 || value.includes("\0")) invalid("Informe o motivo da alteração (até 1000 caracteres).");
  return value.trim();
}
function readPrice(value: unknown): number {
  if (!positive(value) || value > 2147483647) invalid("Informe uma tabela de preço válida.");
  return value;
}
function readDayInput(input: unknown): OperationalDayInput {
  const data = record(input, ["date", "version", "priceTableId", "dayUseOpen", "validity", "onlineLimit", "ticketTypes", "serviceIds", "reason"]);
  const date = readDate(data.date, true);
  const version = readVersion(data.version);
  const priceTableId = readPrice(data.priceTableId);
  const reason = readReason(data.reason);
  const { dayUseOpen, validity, onlineLimit, ticketTypes, serviceIds } = data;
  if (typeof dayUseOpen !== "boolean" || !["day", "7_days", "30_days", "6_months"].includes(String(validity)) || typeof validity !== "string") invalid();
  if (onlineLimit !== null && (typeof onlineLimit !== "number" || !Number.isInteger(onlineLimit) || onlineLimit < 0 || onlineLimit > 2147483647)) invalid("O limite online deve ser um inteiro não negativo ou ficar sem limite.");
  if (!Array.isArray(ticketTypes) || ticketTypes.some((type) => !["norma", "infan", "isent"].includes(type)) || new Set(ticketTypes).size !== ticketTypes.length) invalid("Selecione os tipos de ingresso sem repetições.");
  if (!Array.isArray(serviceIds) || serviceIds.some((id) => !positive(id)) || new Set(serviceIds).size !== serviceIds.length) invalid("Selecione serviços válidos sem repetições.");
  return { date, version, priceTableId, reason, dayUseOpen, validity: validity as OperationalValidity, onlineLimit, ticketTypes, serviceIds };
}


async function readDay(client: QueryClient, park: OperationalParkId, date: string, lock = false): Promise<OperationalDay> {
  const config = (await client.query<ConfigRow>(`SELECT ${configColumns} FROM operacao_dias WHERE parque=$1 AND data=$2::date${lock ? " FOR UPDATE" : ""}`, [park, date])).rows[0];
  const agendas = (await client.query<{ id: number; price: number | null; open: boolean; soldOut: boolean }>(
    `SELECT idagenda AS id, idtabpreco AS price, stagenda IN ('abe','lot') AS open, stagenda='lot' AS "soldOut" FROM agenda
     WHERE dtagenda=$1::date AND tpagenda IN ('padra','promo')
       ${config?.dayUseAgendaId ? "AND idagenda=$2" : ""}
     ORDER BY idagenda${lock ? " FOR UPDATE" : ""}`,
    config?.dayUseAgendaId ? [date, config.dayUseAgendaId] : [date],
  )).rows;
  if ((!config && agendas.length > 1) || (config && !config.dayUseAgendaId && agendas.length > 0)) {
    throw new OperationalDayError("ambiguous_agenda", "A data possui agendas de day use sem vínculo único. Revise a programação antes de editar.");
  }
  if (config?.dayUseAgendaId && !agendas[0]) {
    throw new OperationalDayError("version_conflict", "A agenda vinculada mudou. Atualize a programação.");
  }
  const services = await client.query<{ id: string }>("SELECT servico_id AS id FROM servico_datas WHERE parque=$1 AND data=$2::date ORDER BY servico_id", [park, date]);
  const agenda = agendas[0];
  return {
    date, version: config?.version ?? null, priceTableId: config?.priceTableId ?? agenda?.price ?? null,
    dayUseAgendaId: config?.dayUseAgendaId ?? agenda?.id ?? null, dayUseOpen: agenda?.open === true,
    validity: config?.validity ?? "day", onlineLimit: config?.onlineLimit ?? null,
    ticketTypes: config?.ticketTypes ?? ["norma", "infan", "isent"], serviceIds: services.rows.map((row) => catalogId(row.id)),
    closed: config?.closed ?? false,
    ...(agenda?.soldOut ? { onlineSoldOut: true } : {}),
  };
}

export async function getOperationalDay(date: string): Promise<OperationalDay> {
  readDate(date);
  return readDay(getOperationalCatalogPool(), getOperationalParkId(), date);
}

export async function listOperationalDays(startDate: string, endDate: string): Promise<OperationalDay[]> {
  readDate(startDate); readDate(endDate);
  if (endDate < startDate || Number(new Date(`${endDate}T00:00:00Z`)) - Number(new Date(`${startDate}T00:00:00Z`)) > 365 * 86400000) invalid("Consulte um intervalo de até 366 dias.");
  const park = getOperationalParkId();
  const pool = getOperationalCatalogPool();
  const result = await pool.query<ConfigRow & {
    agendaDate: string | null; agendaType: string | null; agendaOpen: boolean | null; agendaSoldOut: boolean | null;
    serviceIds: string[]; unlinkedAgendas: string;
  }>(`SELECT ${configColumns}, a.dtagenda::text AS "agendaDate", a.tpagenda AS "agendaType",
      a.stagenda IN ('abe','lot') AS "agendaOpen", a.stagenda='lot' AS "agendaSoldOut",
      COALESCE((SELECT array_agg(servico_id ORDER BY servico_id) FROM servico_datas s
        WHERE s.parque=d.parque AND s.data=d.data), '{}'::bigint[]) AS "serviceIds",
      (SELECT count(*) FROM agenda legacy WHERE legacy.dtagenda=d.data
        AND legacy.tpagenda IN ('padra','promo') AND d.day_use_agenda_id IS NULL) AS "unlinkedAgendas"
    FROM operacao_dias d LEFT JOIN agenda a ON a.idagenda=d.day_use_agenda_id
    WHERE d.parque=$1 AND d.data BETWEEN $2::date AND $3::date ORDER BY d.data`, [park, startDate, endDate]);
  return result.rows.map(({ agendaDate, agendaType, agendaOpen, agendaSoldOut, unlinkedAgendas, serviceIds, ...day }) => {
    if (!day.dayUseAgendaId && Number(unlinkedAgendas) > 0) {
      throw new OperationalDayError("ambiguous_agenda", "A data possui agendas de day use sem vínculo único. Revise a programação antes de editar.");
    }
    if (day.dayUseAgendaId && (agendaDate !== day.date || !["padra", "promo"].includes(agendaType ?? ""))) {
      throw new OperationalDayError("version_conflict", "A agenda vinculada mudou. Atualize a programação.");
    }
    return { ...day, dayUseOpen: agendaOpen === true, ...(agendaSoldOut ? { onlineSoldOut: true } : {}), serviceIds: serviceIds.map(catalogId) };
  });
}

function assertEditable(day: OperationalDay, version: number | null) {
  readDate(day.date, true);
  if (day.closed) throw new OperationalDayError("day_closed", "O dia está finalizado e não pode ser alterado.");
  if (day.version !== version || day.version === 2147483647) throw new OperationalDayError("version_conflict", "A programação mudou. Atualize os dados e tente novamente.");
}
async function assertPrice(client: QueryClient, priceTableId: number) {
  const price = await client.query("SELECT idtabpreco FROM tabpreco WHERE idtabpreco=$1 AND COALESCE(LOWER(TRIM(sttabpreco)), '') NOT IN ('ina', 'inat') FOR SHARE", [priceTableId]);
  if (!price.rowCount) invalid("A tabela de preço não existe ou está inativa.");
}
async function persistDay(client: QueryClient, park: OperationalParkId, day: OperationalDay): Promise<OperationalDay> {
  const result = await client.query<{ version: number }>(`
    INSERT INTO operacao_dias (parque,data,tabela_preco_id,day_use_agenda_id,validade,limite_online,tipos_ingresso)
    VALUES ($1,$2::date,$3,$4,$5,$6,$7::jsonb)
    ON CONFLICT (parque,data) DO UPDATE SET tabela_preco_id=EXCLUDED.tabela_preco_id,
      day_use_agenda_id=EXCLUDED.day_use_agenda_id, validade=EXCLUDED.validade,
      limite_online=EXCLUDED.limite_online, tipos_ingresso=EXCLUDED.tipos_ingresso,
      versao=operacao_dias.versao+1, updated_at=NOW()
    RETURNING versao AS version`,
  [park, day.date, day.priceTableId, day.dayUseAgendaId, day.validity, day.onlineLimit, JSON.stringify(day.ticketTypes)]);
  return { ...day, version: result.rows[0].version };
}
async function auditDay(client: PoolClient, park: OperationalParkId, actor: CatalogActor, reason: string, before: OperationalDay, after: OperationalDay, action: string) {
  await registerOpsAuditLog(client, { origem: "painel-dias", acao: action,
    descricao: `Programação de ${after.date} alterada.`, motivo: reason, usuarioNome: actor.name,
    detalhes: { park, actorCpf: actor.cpf, before, after } }, "postgres");
}

export async function saveOperationalDay(input: unknown, actor: CatalogActor): Promise<OperationalDay> {
  const data = readDayInput(input);
  const park = getOperationalParkId();
  return withOperationalCatalogTransaction(async (client) => {
    await lockOperationalDay(client, park, data.date);
    const before = await readDay(client, park, data.date, true);
    assertEditable(before, data.version);
    if (data.onlineLimit !== null && data.onlineLimit < await getOnlineCapacityOccupied(client, park, data.date)) {
      invalid("O limite online não pode ficar abaixo das vagas já vendidas ou reservadas.");
    }
    await assertPrice(client, data.priceTableId);
    if (data.serviceIds.length) {
      const services = await client.query("SELECT id FROM servicos_adicionais WHERE parque=$1 AND id=ANY($2::bigint[]) AND ativo=TRUE ORDER BY id FOR SHARE", [park, data.serviceIds]);
      if (services.rowCount !== data.serviceIds.length) invalid("Um dos serviços não existe, está inativo ou pertence a outro parque.");
    }
    let agendaId = before.dayUseAgendaId;
    if (agendaId !== null) {
      await client.query(`UPDATE agenda SET idtabpreco=$1, stagenda=CASE WHEN stagenda='lot' AND $2='abe' THEN 'lot' ELSE $2 END,
        dtualt=(NOW() AT TIME ZONE 'America/Sao_Paulo')::date,
        hrualt=(NOW() AT TIME ZONE 'America/Sao_Paulo')::time, usualt=$3 WHERE idagenda=$4`,
      [data.priceTableId, data.dayUseOpen ? "abe" : "fec", actor.cpf, agendaId]);
    } else if (data.dayUseOpen) {
      const result = await client.query<{ id: number }>(`INSERT INTO agenda (idtabpreco,dtagenda,tpagenda,stagenda,dtcadastro,hrcadastro,usucadastro)
        VALUES ($1,$2::date,'padra','abe',(NOW() AT TIME ZONE 'America/Sao_Paulo')::date,
          (NOW() AT TIME ZONE 'America/Sao_Paulo')::time,$3) RETURNING idagenda AS id`, [data.priceTableId, data.date, actor.cpf]);
      agendaId = result.rows[0].id;
    }
    const { reason, ...configuration } = data;
    const after = await persistDay(client, park, { ...configuration, dayUseAgendaId: agendaId, closed: false, ...(before.onlineSoldOut && data.dayUseOpen ? { onlineSoldOut: true } : {}) });
    await client.query("DELETE FROM servico_datas WHERE parque=$1 AND data=$2::date", [park, data.date]);
    if (data.serviceIds.length) await client.query("INSERT INTO servico_datas (parque,data,servico_id) SELECT $1,$2::date,id FROM unnest($3::bigint[]) AS id", [park, data.date, data.serviceIds]);
    await auditDay(client, park, actor, reason, before, after, "configure");
    return after;
  });
}

export async function applyOperationalPriceTable(input: unknown, actor: CatalogActor): Promise<OperationalDay[]> {
  const data = record(input, ["dates", "priceTableId", "reason"]);
  const priceTableId = readPrice(data.priceTableId);
  const reason = readReason(data.reason);
  if (!Array.isArray(data.dates) || data.dates.length < 1 || data.dates.length > 366) invalid("Selecione entre 1 e 366 datas.");
  const dates = data.dates.map((entry) => {
    const value = record(entry, ["date", "version"]);
    return { date: readDate(value.date, true), version: readVersion(value.version) };
  }).sort((a, b) => a.date.localeCompare(b.date));
  if (new Set(dates.map(({ date }) => date)).size !== dates.length) invalid("Não repita datas na seleção.");
  const park = getOperationalParkId();
  return withOperationalCatalogTransaction(async (client) => {
    for (const { date } of dates) await lockOperationalDay(client, park, date);
    await assertPrice(client, priceTableId);
    const days: OperationalDay[] = [];
    for (const { date, version } of dates) {
      const before = await readDay(client, park, date, true);
      assertEditable(before, version);
      if (before.dayUseAgendaId !== null) await client.query(`UPDATE agenda SET idtabpreco=$1,
        dtualt=(NOW() AT TIME ZONE 'America/Sao_Paulo')::date,
        hrualt=(NOW() AT TIME ZONE 'America/Sao_Paulo')::time, usualt=$2 WHERE idagenda=$3`, [priceTableId, actor.cpf, before.dayUseAgendaId]);
      const after = await persistDay(client, park, { ...before, priceTableId });
      await auditDay(client, park, actor, reason, before, after, "price_batch");
      days.push(after);
    }
    return days;
  });
}
