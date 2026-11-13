import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createDayProgram, getDayProgram, getDayPrograms, markDayProgramExported, saveDayProgram, type DayProgramGroupInput } from "./day-program";
const mock = vi.hoisted(() => ({ pool: null as Pool | null }));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => mock.pool, getIngressoSistemaDbDialect: () => "postgres" }));
const connectionString = process.env.PANEL_TEST_DATABASE_URL;
if (connectionString) {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || url.pathname !== "/chargeback_test_painel" || url.search || url.hash) {
    throw new Error("PANEL_TEST_DATABASE_URL must target chargeback_test_painel on 127.0.0.1 without URL options");
  }
}
const date = "2099-01-01";
const actor = { name: "Gerente", cpf: "00000000001" };
const group: DayProgramGroupInput = { agendaId: 1, clientId: 1, plannedPeople: 90, contact: "Responsável", phone: "11999999999", transportMode: "client", carrierId: null, carrierContact: null, carrierPhone: null, boardingTime: "07:30", observations: null, buses: 2, vans: 0 };
describe.skipIf(!connectionString)("day program PostgreSQL transactions", () => {
  const schema = `day_program_it_${randomBytes(8).toString("hex")}`;
  let admin: Pool; let pool: Pool; let created = false;
  beforeAll(async () => {
    admin = new Pool({ connectionString, connectionTimeoutMillis: 2000 });
    await admin.query(`CREATE SCHEMA ${schema}`); created = true;
    pool = new Pool({ connectionString, options: `-c search_path=${schema}`, connectionTimeoutMillis: 2000 }); mock.pool = pool;
    await pool.query(`
      CREATE TABLE agenda (idagenda INTEGER PRIMARY KEY,dtagenda DATE,tpagenda TEXT DEFAULT 'escol');
      CREATE TABLE compra (idcompra INTEGER PRIMARY KEY,stcompra TEXT,tpcompra TEXT,formapag TEXT);
      CREATE TABLE voucher (id INTEGER PRIMARY KEY,idcompra INTEGER,idagenda INTEGER,dtinicio_validade DATE,parque_operacional TEXT,tpvoucher TEXT,idescola INTEGER,servico_id INTEGER,stusado TEXT);
      CREATE TABLE clientes (idcliente INTEGER PRIMARY KEY,nome TEXT,endereco TEXT);
      CREATE TABLE agenda_extras (idagenda INTEGER REFERENCES agenda,idcliente INTEGER REFERENCES clientes,PRIMARY KEY(idagenda,idcliente));
      CREATE TABLE operacao_dias (parque TEXT,data DATE,estado TEXT,PRIMARY KEY(parque,data));
      CREATE TABLE contrato_escolar_agendamento (idcontrato INTEGER,agenda_id INTEGER,cliente_id INTEGER,status TEXT,confirmado_em TIMESTAMP,
        escola_endereco TEXT,representante_nome TEXT,responsavel_nome TEXT,responsavel_telefone TEXT,observacao TEXT);
      CREATE TABLE edicoes_log (id SERIAL PRIMARY KEY,origem VARCHAR(30),acao VARCHAR(30),compra_id INTEGER,movimentacao_id INTEGER,
        movimentacao_tipo VARCHAR(20),periodo_id INTEGER,folha_id INTEGER,descricao TEXT,motivo TEXT,usuario_nome VARCHAR(255) CHECK(usuario_nome <> 'Erro de auditoria'),detalhes_json TEXT,created_at TIMESTAMPTZ DEFAULT now());
    `);
    await pool.query(await readFile(new URL("../../docs/sql/2026-11-12-day-program.sql", import.meta.url), "utf8"));
    await pool.query(await readFile(new URL("../../docs/sql/2026-11-12-day-program.sql", import.meta.url), "utf8"));
    await pool.query(await readFile(new URL("../../docs/sql/2026-11-12-weather-forecast.sql", import.meta.url), "utf8"));
  });
  afterAll(async () => { try { await pool?.end(); if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); } finally { await admin?.end(); } });
  beforeEach(async () => {
    vi.stubEnv("OPERATIONAL_PARK_ID", "rincao");
    await pool.query(`TRUNCATE weather_forecast_days, weather_forecast_cache, programacao_exportacoes, compra, voucher, programacao_contratacoes, passeio_veiculos, passeio_operacao, transportadores, programacoes_dia, operacao_dias, agenda_extras, clientes, agenda, contrato_escolar_agendamento, edicoes_log RESTART IDENTITY;
      DELETE FROM programacao_contratacao_catalogo WHERE ordem=100;
      INSERT INTO agenda (idagenda,dtagenda) VALUES (1,'2099-01-01'),(2,'2099-01-02'),(3,'2000-01-01');
      INSERT INTO clientes VALUES (1,'Escola A','Cadastro A'),(2,'Escola B',NULL);
      INSERT INTO agenda_extras VALUES (1,1),(1,2),(2,1),(3,1);
      INSERT INTO contrato_escolar_agendamento VALUES (1,1,1,'agendado',now(),'Contrato A','Representante','Contato contrato','1234','Observação contrato');`);
  });
  afterEach(() => vi.unstubAllEnvs());
  it("reads without writes or DDL, preserves two clients on one agenda, actual origins and missing values", async () => {
    const spy = vi.spyOn(pool, "connect");
    const day = await getDayProgram(date);
    expect(day).toMatchObject({ version: null, status: "uncreated", weather: { status: "unavailable" } });
    expect(day.groups).toHaveLength(2);
    expect(day.groups[0]).toMatchObject({ agendaId: 1, clientId: 1, address: "Cadastro A", contact: "Contato contrato", buses: null, origins: { address: "client", contact: "contract" } });
    expect(day.groups[1]).toMatchObject({ address: null, contact: null, plannedPeople: null, buses: null });
    expect(day.hiringItems).toHaveLength(9);
    expect(Object.isFrozen(day.groups[0])).toBe(true);
    expect((await pool.query("SELECT count(*)::integer AS n FROM programacoes_dia")).rows[0].n).toBe(0);
    expect((await pool.query("SELECT count(*)::integer AS n FROM edicoes_log")).rows[0].n).toBe(0);
    spy.mockRestore();
    const client = await pool.connect(); const query = vi.spyOn(client, "query");
    const connect = vi.spyOn(pool, "connect").mockImplementationOnce(() => Promise.resolve(client));
    await getDayProgram(date);
    expect(query.mock.calls.every(([sql]) => !/^(CREATE|ALTER|INSERT|UPDATE|DELETE)/i.test(String(sql).trim()))).toBe(true);
    query.mockRestore(); connect.mockRestore();
  });
  it("creates idempotently and rejects saving an uncreated date", async () => {
    await expect(saveDayProgram(date, { version: 1, groups: [group] }, actor)).rejects.toMatchObject({ code: "uncreated" });
    const values = await Promise.all([createDayProgram(date, {}, actor), createDayProgram(date, {}, actor)]);
    expect(values.map((v) => v.version)).toEqual([1,1]);
    expect((await pool.query("SELECT count(*)::integer AS n FROM edicoes_log")).rows[0].n).toBe(1);
  });
  it('does not remove a waiting vehicle that already has counting history', async () => {
    await createDayProgram(date,{},actor); const program = await saveDayProgram(date,{ version: 1,groups: [group] },actor);
    await pool.query('ALTER TABLE passeio_veiculos ADD COLUMN current_count_id uuid');
    try {
      await pool.query("UPDATE passeio_veiculos SET current_count_id='11111111-1111-1111-1111-111111111111' WHERE id=1");
      await expect(saveDayProgram(date,{ version: program.version,groups: [{ ...group,buses: 0 }] },actor)).rejects.toMatchObject({ code: 'vehicle_started' });
      expect((await pool.query('SELECT count(*) FROM passeio_veiculos')).rows[0].count).toBe('2');
    } finally { await pool.query('ALTER TABLE passeio_veiculos DROP COLUMN current_count_id'); }
  });
  it("serializes competing autosaves and retains the winner without overwriting its draft", async () => {
    await createDayProgram(date, {}, actor);
    const attempts = await Promise.allSettled([saveDayProgram(date, { version: 1, observations: "A" }, actor), saveDayProgram(date, { version: 1, observations: "B" }, actor)]);
    expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(attempts.find((r) => r.status === "rejected")).toMatchObject({ reason: { code: "version_conflict" } });
    const winner = attempts.find((r) => r.status === "fulfilled");
    expect(await getDayProgram(date)).toMatchObject({ version: 2, observations: winner?.status === "fulfilled" ? winner.value.observations : "missing" });
  });
  it("edits only the composite group and preserves stable vehicle IDs/counting rows", async () => {
    await createDayProgram(date, {}, actor);
    const saved = await saveDayProgram(date, { version: 1, groups: [group] }, actor);
    expect(saved.groups[0]).toMatchObject({ plannedPeople: 90, buses: 2, vans: 0, origins: { contact: "operational" } });
    expect(saved.groups[1]).toMatchObject({ plannedPeople: null, buses: null });
    const [first,second] = saved.groups[0].vehicles;
    await pool.query("UPDATE passeio_veiculos SET estado='counting',versao=2 WHERE id=$1", [first.id]);
    const decreased = await saveDayProgram(date, { version: 2, groups: [{ ...group, buses: 1 }] }, actor);
    expect(decreased.groups[0].vehicles).toMatchObject([{ id: first.id, state: "counting", version: 2 }]);
    expect(decreased.groups[0].vehicles.find((v) => v.id === second.id)).toBeUndefined();
    await expect(saveDayProgram(date, { version: 3, groups: [{ ...group, buses: 0 }] }, actor)).rejects.toMatchObject({ code: "vehicle_started" });
    expect((await getDayProgram(date)).version).toBe(3);
    await expect(pool.query("DELETE FROM agenda_extras WHERE idagenda=1 AND idcliente=1")).rejects.toMatchObject({ code: "23503" });
  });
  it("keeps unknown vehicle planning null when only contact data is completed", async () => {
    await createDayProgram(date, {}, actor);
    const saved = await saveDayProgram(date, { version: 1, groups: [{ ...group, buses: null, vans: null }] }, actor);
    expect(saved.groups[0]).toMatchObject({ contact: "Responsável", buses: null, vans: null, vehicles: [] });
    await expect(saveDayProgram(date, { version: 2, groups: [{ ...group, buses: null }] }, actor)).rejects.toMatchObject({ code: "invalid_input" });
  });
  it("persists carriers and extra hiring catalog items for later dates without carrying assignments", async () => {
    await createDayProgram(date, {}, actor);
    const saved = await saveDayProgram(date, { version: 1, groups: [{ ...group, transportMode: "carrier", carrier: { name: "Transportes A", contact: "Ana", phone: "123" } }], hiringItems: [{ name: "Som", value: "João" }] }, actor);
    expect(saved.groups[0].carrierId).toBe(saved.carriers[0].id);
    const next = await getDayProgram("2099-01-02");
    expect(next.carriers).toEqual(saved.carriers);
    expect(next.hiringItems.find((i) => i.name === "Som")).toMatchObject({ value: null });
    expect(next.groups[0].carrierId).toBeNull();
  });
  it("reuses an existing carrier after a second new-name autosave with revised trip contacts", async () => {
    await createDayProgram(date, {}, actor);
    const input = { ...group, transportMode: "carrier", carrier: { name: "Transportes A", contact: "Ana", phone: "111" }, carrierContact: "Ana", carrierPhone: "111" };
    const first = await saveDayProgram(date, { version: 1, groups: [input] }, actor);
    const next = await saveDayProgram(date, { version: 2, groups: [{ ...input, carrier: { ...input.carrier, phone: "222" }, carrierPhone: "222" }] }, actor);
    expect(next.groups[0]).toMatchObject({ carrierId: first.groups[0].carrierId, carrierPhone: "222" });
    expect(next.carriers).toEqual(first.carriers); expect(next.carriers[0].phone).toBe("111");
  });
  it("resolves concurrent new-name carrier creation across dates to one stable ID", async () => {
    await createDayProgram(date, {}, actor); await createDayProgram("2099-01-02", {}, actor);
    const attempts = await Promise.all([
      saveDayProgram(date, { version: 1, groups: [{ ...group, transportMode: "carrier", carrier: { name: "Transportes A", contact: "A", phone: "111" }, carrierContact: "A", carrierPhone: "111" }] }, actor),
      saveDayProgram("2099-01-02", { version: 1, groups: [{ ...group, agendaId: 2, transportMode: "carrier", carrier: { name: "transportes a", contact: "B", phone: "222" }, carrierContact: "B", carrierPhone: "222" }] }, actor),
    ]);
    expect(attempts[0].groups[0].carrierId).toBe(attempts[1].groups[0].carrierId);
    expect(attempts.map((result) => result.groups[0].carrierPhone)).toEqual(["111", "222"]);
    expect((await pool.query("SELECT count(*)::integer AS n FROM transportadores")).rows[0].n).toBe(1);
  });
  it("bulk statuses use current material fingerprints without multiplying query count by date", async () => {
    const original = await createDayProgram(date, {}, actor);
    await markDayProgramExported(date, 1, actor, { expectedFingerprint: original.sourceFingerprint });
    const dates = Array.from({ length: 31 }, (_, i) => `2099-01-${String(i + 1).padStart(2, "0")}`);
    const client = await pool.connect(); const query = vi.spyOn(client, "query");
    const connect = vi.spyOn(pool, "connect").mockImplementationOnce(() => Promise.resolve(client));
    const batch = await getDayPrograms(dates);
    const batchQueries = query.mock.calls.length;
    query.mockRestore(); connect.mockRestore();
    expect(batch).toHaveLength(31); expect(batch[0]).toMatchObject({ version: 1, status: "exported" });
    expect(batch[1]).toMatchObject({ version: null, status: "uncreated" });
    const singleClient = await pool.connect(); const singleQuery = vi.spyOn(singleClient, "query");
    const singleConnect = vi.spyOn(pool, "connect").mockImplementationOnce(() => Promise.resolve(singleClient));
    expect(await getDayProgram(date)).toEqual(batch[0]);
    expect(singleQuery.mock.calls.length).toBe(batchQueries);
    singleQuery.mockRestore(); singleConnect.mockRestore();
    await pool.query("UPDATE clientes SET nome='Atualizado' WHERE idcliente=1");
    const changedClient = (await getDayPrograms(dates))[0];
    expect(changedClient).toMatchObject({ version: 1, status: "created" });
    await markDayProgramExported(date, 1, actor, { expectedFingerprint: changedClient.sourceFingerprint });
    await pool.query(`INSERT INTO agenda VALUES (4,'2099-01-01','padra'); INSERT INTO compra VALUES (1,'conc','ponli',NULL);
      INSERT INTO voucher VALUES (1,1,4,NULL,NULL,'norma',NULL,NULL,NULL)`);
    expect((await getDayPrograms(dates))[0]).toMatchObject({ version: 1, status: "created", dayUseSold: 1 });
    expect((await getDayPrograms(dates))[1].dayUseSold).toBe(0);
  });
  it("includes cached weather in immutable export snapshots and invalidates changed forecasts without fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected weather request"));
    try {
      const original = await createDayProgram(date, {}, actor);
      const exported = await markDayProgramExported(date, 1, actor, { expectedFingerprint: original.sourceFingerprint });
      const snapshot = { ...original.weather, status: "available", summary: "Às 12:00: 24 °C", source: "MET Norway", temperatureC: 24,
        queriedAt: new Date().toISOString(), modelUpdatedAt: new Date().toISOString(), forecastAt: "2099-01-01T15:00:00.000Z" };
      await pool.query(`INSERT INTO weather_forecast_days (parque,data,latitude,longitude,source,queried_at,model_updated_at,snapshot)
        VALUES ('rincao',$1,-23.7769,-46.7475,'MET Norway',now(),now(),$2::jsonb)`, [date, JSON.stringify(snapshot)]);
      const changed = await getDayProgram(date);
      expect(changed).toMatchObject({ version: 1, status: "created", weather: { status: "available", temperatureC: 24, source: "MET Norway" } });
      expect(changed.sourceFingerprint).not.toBe(original.sourceFingerprint);
      expect((await pool.query("SELECT snapshot FROM programacao_exportacoes WHERE id=$1", [exported.exportId])).rows[0].snapshot.weather.status).toBe("unavailable");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); }
  });
  it("overrides carrier contacts per trip without changing another group or the catalog", async () => {
    await createDayProgram(date, {}, actor);
    const first = await saveDayProgram(date, { version: 1, groups: [{ ...group, transportMode: "carrier", carrier: { name: "Transportes A", contact: "Padrão", phone: "111" }, carrierContact: "Padrão", carrierPhone: "111" }] }, actor);
    const carrierId = first.carriers[0].id;
    const second = await saveDayProgram(date, { version: 2, groups: [{ ...group, clientId: 2, transportMode: "carrier", carrierId, carrierContact: "Padrão", carrierPhone: "111" }] }, actor);
    await markDayProgramExported(date, 3, actor, { expectedFingerprint: second.sourceFingerprint });
    const changed = await saveDayProgram(date, { version: 3, groups: [{ ...group, transportMode: "carrier", carrierId, carrierContact: "Motorista A", carrierPhone: "222" }] }, actor);
    expect(changed.groups[0]).toMatchObject({ carrierContact: "Motorista A", carrierPhone: "222" });
    expect(changed.groups[1]).toMatchObject({ carrierContact: "Padrão", carrierPhone: "111" });
    expect(changed.carriers[0]).toMatchObject({ contact: "Padrão", phone: "111" });
    expect(changed.sourceFingerprint).not.toBe(second.sourceFingerprint);
    const cleared = await saveDayProgram(date, { version: 4, groups: [{ ...group, transportMode: "carrier", carrierId, carrierContact: null, carrierPhone: null }] }, actor);
    expect(cleared.groups[0]).toMatchObject({ carrierContact: null, carrierPhone: null });
    expect(cleared.groups[1]).toMatchObject({ carrierContact: "Padrão", carrierPhone: "111" });
    await pool.query("UPDATE passeio_operacao SET carrier_contact_override=FALSE WHERE agenda_id=1 AND cliente_id=1");
    expect((await getDayProgram(date)).groups[0]).toMatchObject({ carrierContact: "Padrão", carrierPhone: "111" });
  });
  it("rolls back canonical groups, vehicles, catalog and program revision if audit fails", async () => {
    await createDayProgram(date, {}, actor);
    await expect(saveDayProgram(date, { version: 1, groups: [group], hiringItems: [{ name: "Som", value: "João" }] }, { name: "Erro de auditoria", cpf: null })).rejects.toMatchObject({ code: "23514" });
    const day = await getDayProgram(date);
    expect(day).toMatchObject({ version: 1 }); expect(day.groups[0].vehicles).toEqual([]);
    expect(day.hiringItems.some((i) => i.name === "Som")).toBe(false);
  });
  it("requires a fresh explicit past authorization on every write and audits its reason", async () => {
    const past = "2000-01-01";
    await expect(createDayProgram(past, {}, actor)).rejects.toMatchObject({ code: "past_readonly" });
    await createDayProgram(past, { allowPast: true, reason: "Correção histórica" }, actor);
    await expect(saveDayProgram(past, { version: 1 }, actor)).rejects.toMatchObject({ code: "past_readonly" });
    await saveDayProgram(past, { version: 1, observations: "Conferido", allowPast: true, reason: "Conferência" }, actor);
    expect((await pool.query("SELECT motivo,detalhes_json::jsonb->>'actorCpf' AS cpf FROM edicoes_log ORDER BY id")).rows).toEqual([{ motivo: "Correção histórica", cpf: actor.cpf }, { motivo: "Conferência", cpf: actor.cpf }]);
    expect(await getDayProgram(past)).toMatchObject({ readOnly: true, status: "past_created" });
  });
  it("rechecks export revision under lock, and further edits make exports stale", async () => {
    const original = await createDayProgram(date, {}, actor);
    const exported = await markDayProgramExported(date, 1, actor, { expectedFingerprint: original.sourceFingerprint });
    expect(exported).toMatchObject({ version: 1, exportedRevision: 1, status: "exported" }); expect(exported.exportedAt).not.toBeNull();
    await saveDayProgram(date, { version: 1, groups: [group] }, actor);
    await expect(markDayProgramExported(date, 1, actor, { expectedFingerprint: original.sourceFingerprint })).rejects.toMatchObject({ code: "version_conflict" });
    expect(await getDayProgram(date)).toMatchObject({ version: 2, exportedRevision: 1, status: "created" });
    expect(original).toMatchObject({ version: 1, exportedRevision: null }); expect(original.groups[0].vehicles).toEqual([]);
  });
  it("detects live source changes at the same revision and retains immutable historical snapshots", async () => {
    const original = await createDayProgram(date, {}, actor);
    const exported = await markDayProgramExported(date, 1, actor, { expectedFingerprint: original.sourceFingerprint });
    expect(exported.exportId).toEqual(expect.any(Number));
    await pool.query("UPDATE clientes SET nome='Escola alterada' WHERE idcliente=1");
    const changed = await getDayProgram(date);
    expect(changed.version).toBe(1); expect(changed.status).toBe("created"); expect(changed.sourceFingerprint).not.toBe(original.sourceFingerprint);
    await expect(markDayProgramExported(date, 1, actor, { expectedFingerprint: original.sourceFingerprint })).rejects.toMatchObject({ code: "version_conflict" });
    const history = (await pool.query("SELECT snapshot FROM programacao_exportacoes WHERE id=$1", [exported.exportId])).rows[0].snapshot;
    expect(history.groups[0].clientName).toBe("Escola A");
    const next = await markDayProgramExported(date, 1, actor, { expectedFingerprint: changed.sourceFingerprint });
    expect(next.exportId).not.toBe(exported.exportId);
    expect((await pool.query("SELECT count(*)::integer AS n FROM programacao_exportacoes")).rows[0].n).toBe(2);
  });
  it("includes only paid admission for the selected date in the material fingerprint", async () => {
    const original = await createDayProgram(date, {}, actor);
    await pool.query(`INSERT INTO agenda VALUES (4,'2099-01-01','padra');
      INSERT INTO compra VALUES (1,'conc','ponli',NULL),(2,'pend','ponli',NULL);
      INSERT INTO voucher VALUES (1,1,4,NULL,NULL,'norma',NULL,NULL,NULL),(2,1,1,NULL,NULL,'escol',1,NULL,NULL),
      (3,2,4,NULL,NULL,'norma',NULL,NULL,NULL),(4,1,4,NULL,NULL,'espec',NULL,1,NULL),
      (5,1,4,NULL,'estancia','norma',NULL,NULL,NULL),(6,1,4,NULL,NULL,'norma',NULL,NULL,'inv');`);
    const changed = await getDayProgram(date);
    expect(changed.dayUseSold).toBe(1); expect(changed.sourceFingerprint).not.toBe(original.sourceFingerprint);
  });
  it("blocks every mutation on a closed day while reads remain available", async () => {
    const original = await createDayProgram(date, {}, actor);
    await pool.query("INSERT INTO operacao_dias VALUES ('rincao',$1,'closed')", [date]);
    for (const call of [() => createDayProgram(date, {}, actor), () => saveDayProgram(date, { version: 1 }, actor), () => markDayProgramExported(date, 1, actor, { expectedFingerprint: original.sourceFingerprint })]) await expect(call()).rejects.toMatchObject({ code: "day_closed" });
    expect(await getDayProgram(date)).toMatchObject({ closed: true, readOnly: true });
  });
  it("propagates missing core tables instead of claiming the program is uncreated", async () => {
    await pool.query("ALTER TABLE programacoes_dia RENAME TO programacoes_dia_hidden");
    try { await expect(getDayProgram(date)).rejects.toMatchObject({ code: "42P01" }); }
    finally { await pool.query("ALTER TABLE programacoes_dia_hidden RENAME TO programacoes_dia"); }
  });
});
