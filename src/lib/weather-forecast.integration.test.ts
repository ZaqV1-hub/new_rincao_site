import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getCachedWeatherForecast, getCachedWeatherForecasts, refreshWeatherForecast } from "./weather-forecast";
import { getSaoPauloToday } from "./operational-date";
import { lockOperationalDay } from "./operational-day-lock";

const mock = vi.hoisted(() => ({ pool: null as Pool | null, fetch: vi.fn<typeof fetch>() }));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => mock.pool, getIngressoSistemaDbDialect: () => "postgres" }));
const connectionString = process.env.PANEL_TEST_DATABASE_URL;
if (connectionString) {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || url.pathname !== "/chargeback_test_painel" || url.search || url.hash) {
    throw new Error("PANEL_TEST_DATABASE_URL must target the chargeback_test_painel scratch database on 127.0.0.1 without URL options");
  }
}
function offsetDate(date: string, days: number) { return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10); }
describe.skipIf(!connectionString)("weather cache with PostgreSQL", () => {
  const schema = `weather_it_${randomBytes(8).toString("hex")}`;
  let admin: Pool; let pool: Pool; let created = false; let now: Date; let date: string;
  function payload(updatedAt = now.toISOString(), symbol = "rain_day") {
    return { geometry: { coordinates: [-46.7475, -23.7769, 750] }, properties: {
      meta: { updated_at: updatedAt, units: { air_temperature: "celsius" } },
      timeseries: [0, 1, 2].flatMap((days) => [12, 15, 18].map((hour) => ({ time: `${offsetDate(date, days)}T${hour}:00:00Z`,
        data: { instant: { details: { air_temperature: hour + days } }, next_6_hours: { summary: { symbol_code: symbol } } } }))),
    } };
  }
  function response(body: unknown = payload(), headers: HeadersInit = {}) { return Response.json(body, { headers: { "Last-Modified": now.toUTCString(), ...headers } }); }
  beforeAll(async () => {
    admin = new Pool({ connectionString, connectionTimeoutMillis: 2000 });
    await admin.query(`CREATE SCHEMA ${schema}`); created = true;
    pool = new Pool({ connectionString, options: `-c search_path=${schema}`, connectionTimeoutMillis: 2000 }); mock.pool = pool;
    await pool.query("CREATE TABLE operacao_dias (parque TEXT NOT NULL,data DATE NOT NULL,estado TEXT NOT NULL DEFAULT 'open',PRIMARY KEY(parque,data))");
    await pool.query(await readFile(new URL("../../docs/sql/2026-11-12-weather-forecast.sql", import.meta.url), "utf8"));
  });
  afterAll(async () => {
    try { await pool?.end(); if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); }
    finally { await admin?.end(); }
  });
  beforeEach(async () => {
    now = new Date(); date = offsetDate(getSaoPauloToday(now), 1);
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now); vi.stubEnv("OPERATIONAL_PARK_ID", "rincao");
    vi.stubGlobal("fetch", mock.fetch); mock.fetch.mockReset(); mock.fetch.mockImplementation(async () => response());
    await pool.query("TRUNCATE weather_forecast_days,weather_forecast_cache,operacao_dias");
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("persists a noon São Paulo sample and source, reuses the complete horizon without another request", async () => {
    const first = await refreshWeatherForecast(date);
    expect(first).toMatchObject({ status: "available", stale: false, summary: "Às 12:00: 15 °C; chuva (próximas 6 h).", forecastAt: `${date}T15:00:00.000Z`,
      source: "MET Norway", license: "CC BY 4.0", coordinates: { latitude: -23.7769, longitude: -46.7475 } });
    expect(Date.parse(first.nextRefreshAt!) - now.getTime()).toBeGreaterThanOrEqual(3 * 3600000);
    expect(await refreshWeatherForecast(date)).toEqual(first);
    expect(await refreshWeatherForecast(offsetDate(date, 1))).toMatchObject({ status: "available", temperatureC: 16 });
    expect(mock.fetch).toHaveBeenCalledTimes(1);
    expect(mock.fetch.mock.calls[0]).toEqual(["https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=-23.7769&lon=-46.7475", expect.objectContaining({
      cache: "no-store", redirect: "error", signal: expect.any(AbortSignal), headers: { "User-Agent": "ClubeRincaoGestao/1.0 (https://cluberincao.com.br)", Accept: "application/json" },
    })]);
    const stored = (await pool.query("SELECT * FROM weather_forecast_days WHERE data=$1::date", [date])).rows[0];
    expect(stored).toMatchObject({ source: "MET Norway", latitude: "-23.7769", longitude: "-46.7475", snapshot: first });
    expect(stored.queried_at.toISOString()).toBe(first.queriedAt); expect(stored.model_updated_at.toISOString()).toBe(first.modelUpdatedAt);
  });
  it("honors longer Expires and conditionally revalidates a 304 without losing data", async () => {
    mock.fetch.mockResolvedValueOnce(response(payload(), { Expires: new Date(now.getTime() + 8 * 3600000).toUTCString() }));
    const first = await refreshWeatherForecast(date);
    expect(Date.parse(first.nextRefreshAt!) - now.getTime()).toBeGreaterThan(7.9 * 3600000);
    await refreshWeatherForecast(date); expect(mock.fetch).toHaveBeenCalledTimes(1);
    await pool.query("UPDATE weather_forecast_cache SET next_refresh_at=clock_timestamp()-interval '1 second'");
    mock.fetch.mockResolvedValueOnce(new Response(null, { status: 304 }));
    const checked = await refreshWeatherForecast(date);
    expect(checked).toMatchObject({ status: "available", temperatureC: 15, stale: false });
    expect(mock.fetch).toHaveBeenCalledTimes(2);
    expect(mock.fetch.mock.calls[1][1]?.headers).toMatchObject({ "If-Modified-Since": now.toUTCString() });
    expect((await pool.query("SELECT payload FROM weather_forecast_cache")).rows[0].payload.points).toHaveLength(9);
  });
  it("keeps the last snapshot after failure, obeys backoff, and does not fetch from GET", async () => {
    const first = await refreshWeatherForecast(date);
    await pool.query("UPDATE weather_forecast_cache SET next_refresh_at=clock_timestamp()-interval '1 second'");
    mock.fetch.mockResolvedValueOnce(new Response(null, { status: 429, headers: { "Retry-After": "18000" } }));
    const failed = await refreshWeatherForecast(date);
    expect(failed).toMatchObject({ status: "available", stale: true, temperatureC: 15, reason: expect.stringContaining("falhou") });
    expect(Date.parse(failed.nextRefreshAt!) - now.getTime()).toBeGreaterThanOrEqual(5 * 3600000);
    expect((await pool.query("SELECT snapshot FROM weather_forecast_days")).rows[0].snapshot).toEqual(first);
    await refreshWeatherForecast(date); await getCachedWeatherForecast(date); expect(mock.fetch).toHaveBeenCalledTimes(2);
  });
  it.each(["timeout", "invalid", "oversized", "orphan304"])("handles %s without retry loops or fabricated data", async (failure) => {
    if (failure === "timeout") mock.fetch.mockRejectedValueOnce(new DOMException("Timed out", "TimeoutError"));
    if (failure === "invalid") mock.fetch.mockResolvedValueOnce(Response.json({}));
    if (failure === "oversized") mock.fetch.mockResolvedValueOnce(new Response(" ".repeat(1024 * 1024 + 1)));
    if (failure === "orphan304") mock.fetch.mockResolvedValueOnce(new Response(null, { status: 304 }));
    expect(await refreshWeatherForecast(date)).toMatchObject({ status: "unavailable", reason: expect.stringContaining("Não foi possível") });
    await refreshWeatherForecast(date); expect(mock.fetch).toHaveBeenCalledTimes(1);
    expect((await pool.query("SELECT * FROM weather_forecast_days")).rowCount).toBe(0);
  });
  it("uses an atomic cross-connection claim, including a process that died after reserving its interval", async () => {
    let finish!: (response: Response) => void; let started!: () => void;
    const began = new Promise<void>((resolve) => { started = resolve; });
    mock.fetch.mockImplementationOnce(() => { started(); return new Promise<Response>((resolve) => { finish = resolve; }); });
    const first = refreshWeatherForecast(date); await began;
    expect(await refreshWeatherForecast(date)).toMatchObject({ status: "unavailable" });
    expect(mock.fetch).toHaveBeenCalledTimes(1); finish(response()); await first;
    await pool.query("UPDATE weather_forecast_cache SET attempted_at=queried_at+interval '1 second',lease_token='00000000-0000-4000-8000-000000000000',lease_until=clock_timestamp()-interval '1 minute'");
    expect(await refreshWeatherForecast(date)).toMatchObject({ status: "available", stale: true, reason: expect.stringContaining("não foi concluída") });
    expect(mock.fetch).toHaveBeenCalledTimes(1);
  });
  it("keeps an older snapshot stale while a refresh is in flight and fresh after successful 304", async () => {
    const first = await refreshWeatherForecast(date);
    expect(first.stale).toBe(false);
    await pool.query("UPDATE weather_forecast_cache SET next_refresh_at=clock_timestamp()-interval '1 second'");
    let finish!: (response: Response) => void; let started!: () => void;
    const began = new Promise<void>((resolve) => { started = resolve; });
    mock.fetch.mockImplementationOnce(() => { started(); return new Promise<Response>((resolve) => { finish = resolve; }); });
    const refreshing = refreshWeatherForecast(date); await began;
    expect(await getCachedWeatherForecast(date)).toMatchObject({ status: "available", stale: true, temperatureC: 15 });
    expect(await refreshWeatherForecast(date)).toMatchObject({ stale: true });
    expect((await pool.query("SELECT snapshot FROM weather_forecast_days")).rows[0].snapshot).toEqual(first);
    expect(mock.fetch).toHaveBeenCalledTimes(2);
    vi.setSystemTime(new Date(now.getTime() + 1000));
    finish(new Response(null, { status: 304 }));
    expect(await refreshing).toMatchObject({ status: "available", stale: false, queriedAt: new Date(now.getTime() + 1000).toISOString() });
  });
  it("checks the day lock again after HTTP; closing the day does not wait on the provider", async () => {
    await pool.query("INSERT INTO operacao_dias (parque,data) VALUES ('rincao',$1::date)", [date]);
    let finish!: (response: Response) => void; let started!: () => void;
    const began = new Promise<void>((resolve) => { started = resolve; });
    mock.fetch.mockImplementationOnce(() => { started(); return new Promise<Response>((resolve) => { finish = resolve; }); });
    const refreshing = refreshWeatherForecast(date); await began;
    const closer = await pool.connect();
    try {
      await closer.query("BEGIN"); await closer.query("SET LOCAL lock_timeout='500ms'"); await lockOperationalDay(closer, "rincao", date);
      await closer.query("UPDATE operacao_dias SET estado='closed'"); await closer.query("COMMIT");
    } finally { closer.release(); finish(response()); }
    expect(await refreshing).toMatchObject({ status: "unavailable", reason: expect.stringContaining("fechamento") });
    expect((await pool.query("SELECT * FROM weather_forecast_days")).rowCount).toBe(0);
    await refreshWeatherForecast(date); expect(mock.fetch).toHaveBeenCalledTimes(1);
  });
  it("preserves historical/closed snapshots and never fetches past, far future, or disabled parks", async () => {
    const first = await refreshWeatherForecast(date);
    const yesterday = offsetDate(getSaoPauloToday(now), -1);
    await pool.query("UPDATE weather_forecast_days SET data=$1::date", [yesterday]);
    expect(await refreshWeatherForecast(yesterday)).toEqual(first);
    expect(await refreshWeatherForecast(offsetDate(date, 20))).toMatchObject({ status: "unavailable", reason: expect.stringContaining("horizonte") });
    await refreshWeatherForecast(date);
    await pool.query("INSERT INTO operacao_dias (parque,data,estado) VALUES ('rincao',$1::date,'closed')", [date]);
    await pool.query("UPDATE weather_forecast_cache SET next_refresh_at=clock_timestamp()-interval '1 second'");
    expect(await refreshWeatherForecast(date)).toEqual(first);
    vi.stubEnv("OPERATIONAL_PARK_ID", "estancia");
    expect(await refreshWeatherForecast(date)).toMatchObject({ status: "unavailable", reason: expect.stringContaining("Estância") });
    expect(mock.fetch).toHaveBeenCalledTimes(1);
  });
  it("chooses closest available time within the civil day, labels unknown condition and stale source", async () => {
    const body = payload(new Date(now.getTime() - 25 * 3600000).toISOString(), "unknown_future_code");
    body.properties.timeseries = body.properties.timeseries.slice(0, 1);
    mock.fetch.mockResolvedValueOnce(response(body));
    expect(await refreshWeatherForecast(date)).toMatchObject({ status: "available", stale: true, temperatureC: 12, condition: null,
      summary: "Às 09:00: 12 °C; condição indisponível.", reason: expect.stringContaining("modelo meteorológico") });
    expect(await refreshWeatherForecast(offsetDate(date, 1))).toMatchObject({ status: "unavailable" });
    expect(mock.fetch).toHaveBeenCalledTimes(1);
  });
  it("does not assign a 02:00Z point to the following São Paulo civil day", async () => {
    const body = payload(); body.properties.timeseries = [body.properties.timeseries[0]]; body.properties.timeseries[0].time = `${date}T02:00:00Z`;
    mock.fetch.mockResolvedValueOnce(response(body));
    expect(await refreshWeatherForecast(date)).toMatchObject({ status: "unavailable" });
    expect((await pool.query("SELECT * FROM weather_forecast_days")).rowCount).toBe(0);
  });
  it("reads a whole month in two batched SELECTs through the supplied transaction", async () => {
    await refreshWeatherForecast(date); const query = vi.fn(pool.query.bind(pool));
    const dates = Array.from({ length: 31 }, (_, i) => offsetDate(date, i));
    const result = await getCachedWeatherForecasts(dates, "rincao", { query } as unknown as Pick<import("pg").PoolClient, "query">);
    expect(Object.keys(result)).toHaveLength(31); expect(result[date].status).toBe("available"); expect(query).toHaveBeenCalledTimes(2);
    expect(mock.fetch).toHaveBeenCalledTimes(1);
  });
});
