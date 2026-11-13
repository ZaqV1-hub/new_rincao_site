import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { getOperationalParkId, type OperationalParkId } from "@/lib/operational-day-contract";
import { getSaoPauloToday, isCivilDate } from "@/lib/operational-date";
import { lockOperationalDay } from "@/lib/operational-day-lock";
import { registerOpsAuditLog } from "@/lib/ops-audit-log";
import { catalogId, getOperationalCatalogPool, withOperationalCatalogTransaction, type CatalogActor } from "@/lib/painel-operational-catalog";

import { getCachedWeatherForecasts, type WeatherForecastDTO } from "@/lib/weather-forecast";

type QueryClient = Pick<PoolClient, "query">;
export type DayProgramVehicle = { id: number; type: "bus" | "van"; plannedPeople: number | null; state: "waiting" | "counting" | "completed"; version: number; addedOnDay: boolean };
export type DayProgramCarrier = { id: number; name: string; contact: string | null; phone: string | null };
export type DayProgramGroup = {
  agendaId: number; clientId: number; clientName: string; address: string | null; representative: string | null;
  contact: string | null; phone: string | null; plannedPeople: number | null;
  transportMode: "unset" | "client" | "carrier"; carrierId: number | null; carrierContact: string | null; carrierPhone: string | null; boardingTime: string | null; observations: string | null;
  origins: { address: "client" | "contract" | null; representative: "contract" | null; contact: "operational" | "contract" | null; phone: "operational" | "contract" | null; observations: "operational" | "contract" | null };
  buses: number | null; vans: number | null; vehicles: DayProgramVehicle[];
};
export type DayProgram = {
  park: OperationalParkId; date: string; version: number | null; exportedRevision: number | null; exportedAt: string | null;
  status: "uncreated" | "created" | "exported" | "past_created" | "past_uncreated";
  sourceFingerprint: string; exportedFingerprint: string | null; exportId: number | null; dayUseSold: number;
  readOnly: boolean; closed: boolean; observations: string | null; groups: DayProgramGroup[];
  carriers: DayProgramCarrier[]; hiringItems: { id: number; name: string; value: string | null }[];
  weather: WeatherForecastDTO;
};
export type DayProgramExportOptions = DayProgramEditOptions & { expectedFingerprint: string };
export type DayProgramEditOptions = { allowPast?: boolean; reason?: string };
export type DayProgramGroupInput = {
  agendaId: number; clientId: number; plannedPeople: number | null; contact: string | null; phone: string | null;
  transportMode: "unset" | "client" | "carrier"; carrierId: number | null; carrierContact: string | null; carrierPhone: string | null;
  carrier?: Omit<DayProgramCarrier, "id">; boardingTime: string | null; observations: string | null;
  buses: number | null; vans: number | null;
};
export type DayProgramInput = DayProgramEditOptions & {
  version: number; groups?: DayProgramGroupInput[]; observations?: string | null;
  hiringItems?: { id?: number; name?: string; value: string | null }[];
};
export class DayProgramError extends Error {
  constructor(readonly code: "invalid_input" | "version_conflict" | "day_closed" | "past_readonly" | "uncreated" | "vehicle_started" | "trip_finalized", message: string) { super(message); }
}
function invalid(message = "Dados da programação inválidos."): never { throw new DayProgramError("invalid_input", message); }
function record(input: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => !keys.includes(key))) invalid();
  return input as Record<string, unknown>;
}
function text(value: unknown, max: number): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > max || value.includes("\0")) invalid();
  return value.trim() || null;
}
function integer(value: unknown, max = 2147483647, min = 1): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) invalid();
  return value;
}
function dateInput(date: string) { if (!isCivilDate(date)) invalid("Informe uma data civil válida."); }
function optionsInput(data: Record<string, unknown>): DayProgramEditOptions {
  if (data.allowPast !== undefined && typeof data.allowPast !== "boolean") invalid();
  const reason = data.reason === undefined ? undefined : text(data.reason, 1000) ?? undefined;
  if (data.allowPast && !reason) invalid("Informe o motivo para editar uma data passada.");
  return { allowPast: data.allowPast as boolean | undefined, reason };
}
function editInput(input: unknown): DayProgramInput {
  const data = record(input, ["version", "groups", "observations", "hiringItems", "allowPast", "reason"]);
  const version = integer(data.version);
  const options = optionsInput(data);
  let groups: DayProgramGroupInput[] | undefined;
  if (data.groups !== undefined) {
    if (!Array.isArray(data.groups) || data.groups.length > 200) invalid();
    groups = data.groups.map((entry) => {
      const g = record(entry, ["agendaId", "clientId", "plannedPeople", "contact", "phone", "transportMode", "carrierId", "carrierContact", "carrierPhone", "carrier", "boardingTime", "observations", "buses", "vans"]);
      if (!["unset", "client", "carrier"].includes(String(g.transportMode))) invalid();
      const carrierId = g.carrierId === null ? null : integer(g.carrierId, Number.MAX_SAFE_INTEGER);
      let carrier: DayProgramGroupInput["carrier"];
      if (g.carrier !== undefined) {
        const c = record(g.carrier, ["name", "contact", "phone"]);
        const name = text(c.name, 160); if (!name) invalid();
        carrier = { name, contact: text(c.contact, 160), phone: text(c.phone, 40) };
      }
      if (g.transportMode === "carrier" ? (carrierId === null) === !carrier : carrierId !== null || !!carrier) invalid("Selecione um transportador ou transporte do cliente.");
      if ((g.buses === null) !== (g.vans === null)) invalid("Informe ônibus e vans juntos, ou deixe ambos a preencher.");
      const carrierContact = text(g.carrierContact, 160);
      const carrierPhone = text(g.carrierPhone, 40);
      if (g.transportMode !== "carrier" && (carrierContact !== null || carrierPhone !== null)) invalid("Contato de transportador exige transporte contratado.");
      const boardingTime = text(g.boardingTime, 5);
      if (boardingTime !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(boardingTime)) invalid("Informe o embarque em HH:mm.");
      return { agendaId: integer(g.agendaId), clientId: integer(g.clientId), plannedPeople: g.plannedPeople === null ? null : integer(g.plannedPeople, 100000, 0),
        contact: text(g.contact, 160), phone: text(g.phone, 40), transportMode: g.transportMode as DayProgramGroupInput["transportMode"], carrierId, carrierContact, carrierPhone, ...(carrier ? { carrier } : {}),
        boardingTime, observations: text(g.observations, 2000), buses: g.buses === null ? null : integer(g.buses, 100, 0), vans: g.vans === null ? null : integer(g.vans, 100, 0) };
    });
    if (new Set(groups.map((g) => `${g.agendaId}:${g.clientId}`)).size !== groups.length) invalid("Não repita grupos.");
  }
  let hiringItems: DayProgramInput["hiringItems"];
  if (data.hiringItems !== undefined) {
    if (!Array.isArray(data.hiringItems) || data.hiringItems.length > 100) invalid();
    hiringItems = data.hiringItems.map((entry) => {
      const item = record(entry, ["id", "name", "value"]);
      if ((item.id === undefined) === (item.name === undefined)) invalid();
      const name = item.name === undefined ? undefined : text(item.name, 160); if (name === null) invalid();
      return { ...(item.id === undefined ? { name } : { id: integer(item.id, Number.MAX_SAFE_INTEGER) }), value: text(item.value, 500) };
    });
    if (new Set(hiringItems.map((i) => i.id ?? i.name!.toLowerCase())).size !== hiringItems.length) invalid("Não repita contratações.");
  }
  return { version, ...options, groups, hiringItems, ...(data.observations === undefined ? {} : { observations: text(data.observations, 2000) }) };
}

async function readPrograms(client: QueryClient, park: OperationalParkId, dates: string[]): Promise<DayProgram[]> {
  const rows = (await client.query<{ date: string; version: number; exportedRevision: number | null; exportedAt: string | null; exportedFingerprint: string | null; exportId: string | null; observations: string | null }>(
    `SELECT data::text AS date, versao AS version, exported_revision AS "exportedRevision", exported_at::text AS "exportedAt", exported_fingerprint AS "exportedFingerprint", export_id::text AS "exportId", observacoes AS observations FROM programacoes_dia WHERE parque=$1 AND data=ANY($2::date[])`, [park, dates])).rows;
  const closedRows = (await client.query<{ date: string; closed: boolean }>("SELECT data::text AS date, estado='closed' AS closed FROM operacao_dias WHERE parque=$1 AND data=ANY($2::date[])", [park, dates])).rows;
  const hasContract = (await client.query("SELECT to_regclass('contrato_escolar_agendamento') IS NOT NULL AS available")).rows[0].available;
  const groups = (await client.query<DayProgramGroup & { date: string; vehiclePlanDefined: boolean }>(`
    SELECT a.dtagenda::text AS date, a.idagenda AS "agendaId", c.idcliente AS "clientId", c.nome AS "clientName",
      COALESCE(NULLIF(trim(to_jsonb(c)->>'endereco'),''), NULLIF(trim(ct.escola_endereco),'')) AS address,
      NULLIF(trim(ct.representante_nome),'') AS representative,
      CASE WHEN o.agenda_id IS NOT NULL THEN o.contato ELSE NULLIF(trim(ct.responsavel_nome),'') END AS contact,
      CASE WHEN o.agenda_id IS NOT NULL THEN o.telefone ELSE NULLIF(trim(ct.responsavel_telefone),'') END AS phone,
      CASE WHEN o.transport_mode='carrier' THEN CASE WHEN o.carrier_contact_override THEN o.carrier_contact ELSE carrier.contato END END AS "carrierContact",
      CASE WHEN o.transport_mode='carrier' THEN CASE WHEN o.carrier_contact_override THEN o.carrier_phone ELSE carrier.telefone END END AS "carrierPhone",
      o.planned_people AS "plannedPeople", COALESCE(o.transport_mode,'unset') AS "transportMode", o.carrier_id::text AS "carrierId", o.boarding_time AS "boardingTime",
      CASE WHEN o.agenda_id IS NOT NULL THEN o.observacoes ELSE NULLIF(trim(ct.observacao),'') END AS observations,
      o.vehicle_plan_defined AS "vehiclePlanDefined",
      json_build_object('address',CASE WHEN NULLIF(trim(to_jsonb(c)->>'endereco'),'') IS NOT NULL THEN 'client' WHEN NULLIF(trim(ct.escola_endereco),'') IS NOT NULL THEN 'contract' END,
        'representative',CASE WHEN NULLIF(trim(ct.representante_nome),'') IS NOT NULL THEN 'contract' END,
        'contact',CASE WHEN o.agenda_id IS NOT NULL THEN 'operational' WHEN NULLIF(trim(ct.responsavel_nome),'') IS NOT NULL THEN 'contract' END,
        'phone',CASE WHEN o.agenda_id IS NOT NULL THEN 'operational' WHEN NULLIF(trim(ct.responsavel_telefone),'') IS NOT NULL THEN 'contract' END,
        'observations',CASE WHEN o.agenda_id IS NOT NULL THEN 'operational' WHEN NULLIF(trim(ct.observacao),'') IS NOT NULL THEN 'contract' END) AS origins
    FROM agenda_extras ae JOIN agenda a ON a.idagenda=ae.idagenda JOIN clientes c ON c.idcliente=ae.idcliente
    LEFT JOIN passeio_operacao o ON o.parque=$1 AND o.agenda_id=ae.idagenda AND o.cliente_id=ae.idcliente
    LEFT JOIN transportadores carrier ON carrier.parque=o.parque AND carrier.id=o.carrier_id
    LEFT JOIN LATERAL (${hasContract ? `SELECT escola_endereco,representante_nome,responsavel_nome,responsavel_telefone,observacao
      FROM contrato_escolar_agendamento WHERE agenda_id=ae.idagenda AND cliente_id=ae.idcliente AND status='agendado'
      ORDER BY confirmado_em DESC NULLS LAST,idcontrato DESC LIMIT 1` : `SELECT NULL::text AS escola_endereco,NULL::text AS representante_nome,NULL::text AS responsavel_nome,NULL::text AS responsavel_telefone,NULL::text AS observacao`}) ct ON TRUE
    WHERE a.dtagenda=ANY($2::date[]) ORDER BY c.nome,a.idagenda,c.idcliente`, [park, dates])).rows;
  const vehicles = (await client.query<DayProgramVehicle & { agendaId: number; clientId: number }>(`SELECT v.id::text, v.agenda_id AS "agendaId",v.cliente_id AS "clientId",v.tipo AS type,
    v.planned_people AS "plannedPeople",v.estado AS state,v.versao AS version,v.added_on_day AS "addedOnDay" FROM passeio_veiculos v JOIN agenda a ON a.idagenda=v.agenda_id
    WHERE v.parque=$1 AND a.dtagenda=ANY($2::date[]) ORDER BY v.id`, [park, dates])).rows;
  const carriers = (await client.query<DayProgramCarrier>(`SELECT id::text,nome AS name,contato AS contact,telefone AS phone FROM transportadores WHERE parque=$1 ORDER BY nome,id`, [park])).rows;
  const hiringItems = (await client.query<{ date: string; id: string; name: string; value: string | null }>(`SELECT dates.date::text, c.id::text,c.nome AS name,v.valor AS value FROM programacao_contratacao_catalogo c CROSS JOIN unnest($2::date[]) AS dates(date)
    LEFT JOIN programacao_contratacoes v ON v.parque=c.parque AND v.item_id=c.id AND v.data=dates.date WHERE c.parque=$1 ORDER BY c.ordem,c.id`, [park, dates])).rows;
  const soldRows = (await client.query<{ date: string; count: string }>(`SELECT COALESCE(v.dtinicio_validade,a.dtagenda)::text AS date, count(*)::text AS count FROM voucher v
    JOIN compra cp ON cp.idcompra=v.idcompra JOIN agenda a ON a.idagenda=v.idagenda
    WHERE COALESCE(v.dtinicio_validade,a.dtagenda)=ANY($2::date[]) AND (v.parque_operacional IS NULL OR v.parque_operacional=$1)
      AND cp.stcompra='conc' AND (cp.tpcompra IN ('ponli','bilhe') OR (cp.tpcompra='reser' AND COALESCE(UPPER(TRIM(cp.formapag)),'') NOT IN ('','N/A')))
      AND v.tpvoucher IN ('norma','infan','isent','corte') AND v.idescola IS NULL AND v.servico_id IS NULL
      AND a.tpagenda IN ('padra','promo') AND v.stusado IS DISTINCT FROM 'inv'
      AND NOT EXISTS (SELECT 1 FROM agenda_extras ae WHERE ae.idagenda=a.idagenda)
    GROUP BY COALESCE(v.dtinicio_validade,a.dtagenda)`, [park, dates])).rows;
  const weather = await getCachedWeatherForecasts(dates, park, client);
  return dates.map((date) => {
    const row = rows.find((entry) => entry.date === date);
    const closed = closedRows.find((entry) => entry.date === date)?.closed === true;
    const dayUseSold = Number(soldRows.find((entry) => entry.date === date)?.count ?? 0);
    if (!Number.isSafeInteger(dayUseSold) || dayUseSold < 0) throw new Error("Quantidade de ingressos fora do intervalo seguro.");
    const past = date < getSaoPauloToday();
    const program: DayProgram = { park, date, version: row?.version ?? null, exportedRevision: row?.exportedRevision ?? null, exportedAt: row?.exportedAt ?? null,
      status: past ? row ? "past_created" : "past_uncreated" : !row ? "uncreated" : row.exportedRevision === row.version ? "exported" : "created",
      sourceFingerprint: "", exportedFingerprint: row?.exportedFingerprint ?? null, exportId: row?.exportId ? catalogId(row.exportId) : null, dayUseSold,
      readOnly: past || closed, closed, observations: row?.observations ?? null,
      groups: groups.flatMap(({ date: groupDate, vehiclePlanDefined, ...g }) => {
        if (groupDate !== date) return [];
        const tripVehicles = vehicles.filter((v) => v.agendaId === g.agendaId && v.clientId === g.clientId).map((v) => ({ id: catalogId(String(v.id)), type: v.type, plannedPeople: v.plannedPeople, state: v.state, version: v.version, addedOnDay: v.addedOnDay }));
        return [{ ...g, carrierId: g.carrierId === null ? null : catalogId(String(g.carrierId)), vehicles: tripVehicles,
          buses: vehiclePlanDefined || tripVehicles.length ? tripVehicles.filter((v) => v.type === "bus").length : null,
          vans: vehiclePlanDefined || tripVehicles.length ? tripVehicles.filter((v) => v.type === "van").length : null }];
      }), carriers: carriers.map((c) => ({ ...c, id: catalogId(String(c.id)) })), hiringItems: hiringItems.flatMap(({ date: itemDate, ...item }) => itemDate === date ? [{ ...item, id: catalogId(item.id) }] : []),
      weather: weather[date] };
    program.sourceFingerprint = createHash("sha256").update(JSON.stringify({ park, date, observations: program.observations, groups: program.groups,
      carriers: program.carriers.filter((carrier) => program.groups.some((group) => group.carrierId === carrier.id)),
      hiringItems: program.hiringItems.filter((item) => item.value !== null), dayUseSold, weather: program.weather })).digest("hex");
    if (program.status === "exported" && program.sourceFingerprint !== program.exportedFingerprint) program.status = "created";
    return program;
  });
}
async function readProgram(client: QueryClient, park: OperationalParkId, date: string): Promise<DayProgram> {
  return (await readPrograms(client, park, [date]))[0];
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.freeze(value); for (const child of Object.values(value)) freeze(child); }
  return value;
}
export async function getDayProgram(date: string): Promise<DayProgram> {
  return (await getDayPrograms([date]))[0];
}
export async function getDayPrograms(dates: string[]): Promise<DayProgram[]> {
  if (!Array.isArray(dates) || dates.length < 1 || dates.length > 31 || new Set(dates).size !== dates.length) invalid("Consulte de 1 a 31 datas, sem repetições.");
  dates.forEach(dateInput);
  const client = await getOperationalCatalogPool().connect();
  let discard = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    try { const data = await readPrograms(client, getOperationalParkId(), dates); await client.query("COMMIT"); return freeze(data); }
    catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
  } finally { client.release(discard); }
}
async function editable(client: PoolClient, park: OperationalParkId, date: string, options: DayProgramEditOptions) {
  await lockOperationalDay(client, park, date);
  if (date < getSaoPauloToday() && !options.allowPast) throw new DayProgramError("past_readonly", "A data passou. Autorize a edição com um motivo.");
  const day = (await client.query("SELECT estado FROM operacao_dias WHERE parque=$1 AND data=$2::date FOR UPDATE", [park, date])).rows[0];
  if (day?.estado === "closed") throw new DayProgramError("day_closed", "O dia está finalizado.");
}
function matchVersion(before: DayProgram, version: number) {
  if (before.version === null) throw new DayProgramError("uncreated", "Crie a programação antes de salvar.");
  if (before.version !== version || version === 2147483647) throw new DayProgramError("version_conflict", "A programação mudou. Atualize antes de salvar; preserve seu rascunho.");
}
async function audit(client: PoolClient, actor: CatalogActor, action: string, options: DayProgramEditOptions, before: DayProgram, after: DayProgram) {
  await registerOpsAuditLog(client, { origem: "painel-programacao", acao: action, descricao: `Programação de ${after.date}.`, motivo: options.reason ?? "Programação do dia",
    usuarioNome: actor.name, detalhes: { park: after.park, date: after.date, actorCpf: actor.cpf, allowPast: options.allowPast === true, before, after } }, "postgres");
}
export async function createDayProgram(date: string, input: unknown, actor: CatalogActor): Promise<DayProgram> {
  dateInput(date); const options = optionsInput(record(input, ["allowPast", "reason"])); const park = getOperationalParkId();
  return withOperationalCatalogTransaction(async (client) => {
    await editable(client, park, date, options);
    const before = await readProgram(client, park, date);
    if (before.version !== null) return freeze(before);
    await client.query("INSERT INTO programacoes_dia (parque,data) VALUES ($1,$2::date)", [park, date]);
    const after = await readProgram(client, park, date); await audit(client, actor, "create", options, before, after); return freeze(after);
  });
}
async function reconcileVehicles(client: PoolClient, park: OperationalParkId, date: string, g: DayProgramGroupInput, actor: CatalogActor) {
  if (g.buses === null || g.vans === null) return;
  for (const [type, desired] of [["bus", g.buses], ["van", g.vans]] as const) {
    const rows = (await client.query<{ id: string; state: string; hasHistory: boolean }>(`SELECT id::text,estado AS state,
      (to_jsonb(passeio_veiculos)->>'current_count_id' IS NOT NULL OR to_jsonb(passeio_veiculos)->>'last_completed_count_id' IS NOT NULL) AS "hasHistory"
      FROM passeio_veiculos WHERE parque=$1 AND agenda_id=$2 AND cliente_id=$3 AND tipo=$4 ORDER BY id FOR UPDATE`, [park, g.agendaId, g.clientId, type])).rows;
    const remove = rows.length - desired;
    if (remove > 0) {
      const waiting = rows.filter((v) => v.state === "waiting" && !v.hasHistory).reverse();
      if (waiting.length < remove) throw new DayProgramError("vehicle_started", "A quantidade não pode remover veículos com contagem iniciada.");
      await client.query("DELETE FROM passeio_veiculos WHERE parque=$1 AND id=ANY($2::bigint[]) AND estado='waiting'", [park, waiting.slice(0, remove).map((v) => v.id)]);
    } else if (remove < 0) {
      await client.query(`INSERT INTO passeio_veiculos (parque,agenda_id,cliente_id,tipo,added_on_day,created_by)
        SELECT $1,$2,$3,$4,$5,$6 FROM generate_series(1,$7::integer)`, [park, g.agendaId, g.clientId, type, date === getSaoPauloToday(), actor.cpf, -remove]);
    }
  }
}
export async function saveDayProgram(date: string, input: unknown, actor: CatalogActor): Promise<DayProgram> {
  dateInput(date); const data = editInput(input); const park = getOperationalParkId();
  return withOperationalCatalogTransaction(async (client) => {
    await editable(client, park, date, data);
    const before = await readProgram(client, park, date); matchVersion(before, data.version);
    for (const g of data.groups ?? []) {
      const group = await client.query(`SELECT ae.idagenda FROM agenda_extras ae JOIN agenda a ON a.idagenda=ae.idagenda WHERE ae.idagenda=$1 AND ae.idcliente=$2 AND a.dtagenda=$3::date FOR SHARE OF ae,a`, [g.agendaId, g.clientId, date]);
      if (!group.rowCount) invalid("O grupo não pertence à data selecionada.");
      const receipt = (await client.query<{ receipt: string | null }>(`SELECT to_jsonb(o)->>'finalized_receipt_id' AS receipt FROM passeio_operacao o WHERE parque=$1 AND agenda_id=$2 AND cliente_id=$3 FOR UPDATE`, [park,g.agendaId,g.clientId])).rows[0]?.receipt;
      if (receipt) throw new DayProgramError("trip_finalized", "O passeio possui recibo finalizado. Solicite revisão financeira antes de alterar a programação.");
      let carrierId = g.carrierId;
      if (g.carrier) {
        // Reuse the stable catalog ID; incoming contacts belong to this trip only.
        await client.query(`INSERT INTO transportadores (parque,nome,contato,telefone) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [park, g.carrier.name, g.carrier.contact, g.carrier.phone]);
        const carrier = (await client.query<{ id: string }>("SELECT id::text FROM transportadores WHERE parque=$1 AND lower(nome)=lower($2) FOR SHARE", [park, g.carrier.name])).rows[0];
        if (!carrier) invalid("Transportador indisponível neste parque.");
        carrierId = catalogId(carrier.id);
      } else if (carrierId !== null && !(await client.query("SELECT id FROM transportadores WHERE parque=$1 AND id=$2 FOR SHARE", [park, carrierId])).rowCount) invalid("Transportador indisponível neste parque.");
      await client.query(`INSERT INTO passeio_operacao (parque,agenda_id,cliente_id,planned_people,contato,telefone,transport_mode,carrier_id,boarding_time,observacoes,vehicle_plan_defined,updated_by,carrier_contact,carrier_phone,carrier_contact_override)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$12,$11,$13,$14,TRUE) ON CONFLICT (parque,agenda_id,cliente_id) DO UPDATE SET
        planned_people=EXCLUDED.planned_people,contato=EXCLUDED.contato,telefone=EXCLUDED.telefone,transport_mode=EXCLUDED.transport_mode,carrier_id=EXCLUDED.carrier_id,
        boarding_time=EXCLUDED.boarding_time,observacoes=EXCLUDED.observacoes,carrier_contact=EXCLUDED.carrier_contact,carrier_phone=EXCLUDED.carrier_phone,carrier_contact_override=TRUE,vehicle_plan_defined=passeio_operacao.vehicle_plan_defined OR EXCLUDED.vehicle_plan_defined,updated_by=EXCLUDED.updated_by,updated_at=now()`,
      [park, g.agendaId, g.clientId, g.plannedPeople, g.contact, g.phone, g.transportMode, carrierId, g.boardingTime, g.observations, actor.cpf, g.buses !== null, g.carrierContact, g.carrierPhone]);
      await reconcileVehicles(client, park, date, g, actor);
    }
    for (const item of data.hiringItems ?? []) {
      let id = item.id;
      if (item.name !== undefined) {
        await client.query("INSERT INTO programacao_contratacao_catalogo (parque,nome) VALUES ($1,$2) ON CONFLICT DO NOTHING", [park, item.name]);
        id = catalogId((await client.query("SELECT id::text FROM programacao_contratacao_catalogo WHERE parque=$1 AND lower(nome)=lower($2)", [park, item.name])).rows[0].id);
      } else if (!(await client.query("SELECT id FROM programacao_contratacao_catalogo WHERE parque=$1 AND id=$2", [park, id])).rowCount) invalid("Item de contratação indisponível.");
      await client.query(`INSERT INTO programacao_contratacoes (parque,data,item_id,valor) VALUES ($1,$2::date,$3,$4)
        ON CONFLICT (parque,data,item_id) DO UPDATE SET valor=EXCLUDED.valor`, [park, date, id, item.value]);
    }
    await client.query(`UPDATE programacoes_dia SET versao=versao+1,observacoes=CASE WHEN $3 THEN $4 ELSE observacoes END,updated_at=now() WHERE parque=$1 AND data=$2::date`, [park, date, data.observations !== undefined, data.observations ?? null]);
    const after = await readProgram(client, park, date); await audit(client, actor, "save", data, before, after); return freeze(after);
  });
}
export async function markDayProgramExported(date: string, version: number, actor: CatalogActor, input: DayProgramExportOptions): Promise<DayProgram> {
  dateInput(date); integer(version); const data = record(input, ["allowPast", "reason", "expectedFingerprint"]);
  const options = optionsInput(data); const park = getOperationalParkId();
  if (typeof data.expectedFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(data.expectedFingerprint)) invalid("Informe a revisão dos materiais gerados.");
  return withOperationalCatalogTransaction(async (client) => {
    await editable(client, park, date, options);
    const before = await readProgram(client, park, date); matchVersion(before, version);
    if (before.sourceFingerprint !== data.expectedFingerprint) throw new DayProgramError("version_conflict", "Os dados da programação mudaram durante a geração. Gere os materiais novamente.");
    await client.query(`INSERT INTO programacao_exportacoes (parque,data,versao,fingerprint,snapshot,actor_name,actor_cpf)
      VALUES ($1,$2::date,$3,$4,$5::jsonb,$6,$7) ON CONFLICT (parque,data,versao,fingerprint) DO NOTHING`,
    [park, date, version, before.sourceFingerprint, JSON.stringify(before), actor.name, actor.cpf]);
    const exported = (await client.query<{ id: string }>("SELECT id::text FROM programacao_exportacoes WHERE parque=$1 AND data=$2::date AND versao=$3 AND fingerprint=$4", [park, date, version, before.sourceFingerprint])).rows[0];
    await client.query("UPDATE programacoes_dia SET exported_revision=versao,exported_at=now(),exported_fingerprint=$3,export_id=$4 WHERE parque=$1 AND data=$2::date", [park, date, before.sourceFingerprint, exported.id]);
    const after = await readProgram(client, park, date); await audit(client, actor, "export", options, before, after); return freeze(after);
  });
}
