import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getOperationalParkId, type OperationalParkId } from "@/lib/operational-day-contract";
import { getSaoPauloToday, isCivilDate } from "@/lib/operational-date";
import { lockOperationalDay } from "@/lib/operational-day-lock";
import { getOperationalCatalogPool } from "@/lib/painel-operational-catalog";

type QueryClient = Pick<PoolClient, "query">;
export type WeatherForecastDTO = {
  status: "available" | "unavailable"; summary: string; reason: string | null; stale: boolean;
  source: "MET Norway" | null; sourceUrl: string | null; license: "CC BY 4.0" | null; licenseUrl: string | null;
  queriedAt: string | null; forecastAt: string | null; modelUpdatedAt: string | null; nextRefreshAt: string | null;
  temperatureC: number | null; condition: string | null; coordinates: { latitude: number; longitude: number } | null;
};
type ForecastPoint = { time: string; temperatureC: number; condition: string | null; periodHours: number | null };
type ForecastPayload = { modelUpdatedAt: string; points: ForecastPoint[] };
type CacheRow = { payload: ForecastPayload | null; queriedAt: string | null; modelUpdatedAt: string | null;
  nextRefreshAt: string | null; lastModified: string | null; lastError: string | null; refreshPending: boolean };
// Official location map in src/components/location-page.tsx; truncate, never round, to four decimals.
const COORDINATES = { latitude: Math.trunc(-23.77692536125703 * 10000) / 10000, longitude: Math.trunc(-46.747566408833706 * 10000) / 10000 };
const SOURCE = { source: "MET Norway", sourceUrl: "https://www.met.no/en", license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/" } as const;
const URL = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${COORDINATES.latitude}&lon=${COORDINATES.longitude}`;
const MIN_REFRESH_MS = 3 * 60 * 60 * 1000;
const MAX_MODEL_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 1024 * 1024;
const CACHE_COLUMNS = `payload,queried_at::text AS "queriedAt",model_updated_at::text AS "modelUpdatedAt",next_refresh_at::text AS "nextRefreshAt",last_modified AS "lastModified",last_error AS "lastError",lease_token IS NOT NULL AS "refreshPending"`;
const CACHE_KEY = "parque=$1 AND latitude=$2 AND longitude=$3";
const conditions: Record<string, string> = {
  clearsky: "céu limpo", fair: "poucas nuvens", partlycloudy: "parcialmente nublado", cloudy: "nublado", fog: "neblina",
  lightrain: "chuva fraca", rain: "chuva", heavyrain: "chuva forte", lightrainshowers: "pancadas de chuva fraca", rainshowers: "pancadas de chuva", heavyrainshowers: "pancadas de chuva forte",
  lightsleet: "chuva e neve fracas", sleet: "chuva e neve", heavysleet: "chuva e neve fortes", lightsleetshowers: "pancadas fracas de chuva e neve", sleetshowers: "pancadas de chuva e neve", heavysleetshowers: "pancadas fortes de chuva e neve",
  lightsnow: "neve fraca", snow: "neve", heavysnow: "neve forte", lightsnowshowers: "pancadas de neve fraca", snowshowers: "pancadas de neve", heavysnowshowers: "pancadas de neve forte",
};

export class WeatherForecastError extends Error {
  readonly code = "invalid_input";
}
function datesInput(dates: string[]) {
  if (!Array.isArray(dates) || dates.length > 31 || dates.some((date) => !isCivilDate(date))) throw new WeatherForecastError("Informe até 31 datas civis válidas.");
}
function unavailable(reason: string, nextRefreshAt: string | null = null): WeatherForecastDTO {
  return { status: "unavailable", summary: "Previsão indisponível", reason, stale: false, source: null, sourceUrl: null,
    license: null, licenseUrl: null, queriedAt: null, forecastAt: null, modelUpdatedAt: null, nextRefreshAt, temperatureC: null, condition: null, coordinates: null };
}
function iso(value: string | null) { const time = value === null ? NaN : Date.parse(value); return Number.isFinite(time) ? new Date(time).toISOString() : null; }
function forecastTime(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/.test(value) && isCivilDate(value.slice(0, 10)) ? iso(value) : null;
}
function withinHorizon(date: string, now: Date) {
  const today = getSaoPauloToday(now);
  return date >= today && Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`) <= 9 * 86400000;
}
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function condition(symbol: unknown): string | null {
  if (typeof symbol !== "string") return null;
  const code = symbol.replace(/_(day|night|polartwilight)$/, "");
  const base = code.replace(/andthunder$/, "");
  return conditions[base] ? `${conditions[base]}${base !== code ? " com trovoadas" : ""}` : null;
}
export function parseWeatherForecast(input: unknown, now = new Date()): ForecastPayload {
  const data = object(input); const properties = object(data.properties); const meta = object(properties.meta);
  const modelUpdatedAt = forecastTime(meta.updated_at);
  const coords = object(data.geometry).coordinates;
  if (!modelUpdatedAt || Date.parse(modelUpdatedAt) > now.getTime() + 3600000 || object(meta.units).air_temperature !== "celsius" ||
      !Array.isArray(coords) || typeof coords[0] !== "number" || typeof coords[1] !== "number" || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1]) ||
      Math.abs(coords[0] - COORDINATES.longitude) > 0.0001 || Math.abs(coords[1] - COORDINATES.latitude) > 0.0001 ||
      !Array.isArray(properties.timeseries) || !properties.timeseries.length || properties.timeseries.length > 500) throw new Error("Invalid weather response");
  const points = properties.timeseries.map((entry): ForecastPoint => {
    const item = object(entry); const forecast = object(item.data); const temperatureC = object(object(forecast.instant).details).air_temperature;
    const time = forecastTime(item.time);
    if (!time || typeof temperatureC !== "number" || !Number.isFinite(temperatureC) || temperatureC < -100 || temperatureC > 70) throw new Error("Invalid weather point");
    const periodHours = [1, 6, 12].find((hours) => typeof object(object(forecast[`next_${hours}_hours`]).summary).symbol_code === "string") ?? null;
    return { time, temperatureC, periodHours, condition: periodHours === null ? null : condition(object(object(forecast[`next_${periodHours}_hours`]).summary).symbol_code) };
  }).sort((a, b) => a.time.localeCompare(b.time));
  if (new Set(points.map((point) => point.time)).size !== points.length) throw new Error("Duplicate weather point");
  return { modelUpdatedAt, points };
}
function staleReason(cache: CacheRow, now: Date): string | null {
  if (cache.lastError) return "A última atualização falhou; previsão anterior preservada.";
  if (cache.refreshPending) return "A atualização não foi concluída; previsão anterior preservada.";
  if (!cache.modelUpdatedAt || Date.parse(cache.modelUpdatedAt) < now.getTime() - MAX_MODEL_AGE_MS) return "O modelo meteorológico está desatualizado; previsão anterior preservada.";
  if (!cache.nextRefreshAt || Date.parse(cache.nextRefreshAt) <= now.getTime()) return "A previsão aguarda atualização.";
  return null;
}
function selectForecast(cache: CacheRow, date: string, now: Date): WeatherForecastDTO {
  const points = cache.payload?.points.filter((point) => getSaoPauloToday(new Date(point.time)) === date) ?? [];
  const target = Date.parse(`${date}T12:00:00-03:00`);
  const point = points.sort((a, b) => Math.abs(Date.parse(a.time) - target) - Math.abs(Date.parse(b.time) - target))[0];
  if (!point || !cache.queriedAt || !cache.modelUpdatedAt) return unavailable("A fonte ainda não fornece previsão para esta data.", iso(cache.nextRefreshAt));
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(point.time));
  const temperature = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(point.temperatureC);
  const reason = staleReason(cache, now);
  return { status: "available", summary: `Às ${time}: ${temperature} °C; ${point.condition ? `${point.condition} (próximas ${point.periodHours} h)` : "condição indisponível"}.`,
    reason, stale: reason !== null, ...SOURCE, queriedAt: iso(cache.queriedAt), forecastAt: point.time, modelUpdatedAt: iso(cache.modelUpdatedAt),
    nextRefreshAt: iso(cache.nextRefreshAt), temperatureC: point.temperatureC, condition: point.condition, coordinates: COORDINATES };
}

export async function getCachedWeatherForecasts(dates: string[], park = getOperationalParkId(), client?: QueryClient): Promise<Record<string, WeatherForecastDTO>> {
  datesInput(dates);
  if (!dates.length) return {};
  if (park !== "rincao") return Object.fromEntries(dates.map((date) => [date, unavailable("Coordenadas da Estância ainda não verificadas.")]));
  const query = client ?? getOperationalCatalogPool(); const now = new Date();
  const cache = (await query.query<CacheRow>(`SELECT ${CACHE_COLUMNS} FROM weather_forecast_cache WHERE ${CACHE_KEY}`, [park, COORDINATES.latitude, COORDINATES.longitude])).rows[0];
  const rows = (await query.query<{ date: string; snapshot: WeatherForecastDTO | null; closed: boolean }>(`SELECT d::text AS date,w.snapshot,COALESCE(o.estado='closed',false) AS closed
    FROM unnest($2::date[]) d LEFT JOIN weather_forecast_days w ON w.parque=$1 AND w.data=d
    LEFT JOIN operacao_dias o ON o.parque=$1 AND o.data=d`, [park, dates])).rows;
  const forecastDates = new Set(cache?.payload?.points.map((point) => getSaoPauloToday(new Date(point.time))));
  return Object.fromEntries(rows.map(({ date, snapshot, closed }) => {
    if (snapshot) {
      if (date < getSaoPauloToday(now) || closed) return [date, snapshot];
      const reason = cache ? staleReason(cache, now) ?? (iso(cache.modelUpdatedAt) !== snapshot.modelUpdatedAt ? "Há uma atualização da fonte disponível para esta data." : null) : "A previsão aguarda atualização.";
      return [date, { ...snapshot, stale: reason !== null, reason, nextRefreshAt: iso(cache?.nextRefreshAt ?? null) }];
    }
    return [date, unavailable(date < getSaoPauloToday(now) ? "Nenhuma previsão foi registrada para esta data passada." : closed ? "Nenhuma previsão foi registrada antes do fechamento." : !withinHorizon(date, now) ? "Data fora do horizonte de até 9 dias da fonte." : cache?.lastError ? "Não foi possível atualizar a previsão. Aguarde a próxima consulta permitida." : cache?.payload && !forecastDates.has(date) ? "A fonte ainda não fornece previsão para esta data." : "Previsão ainda não consultada para esta data.", iso(cache?.nextRefreshAt ?? null))];
  }));
}
export async function getCachedWeatherForecast(date: string, park = getOperationalParkId(), client?: QueryClient): Promise<WeatherForecastDTO> {
  return (await getCachedWeatherForecasts([date], park, client))[date];
}

export function weatherNextRefreshAt(now: Date, headers: Headers): string {
  const expires = Date.parse(headers.get("Expires") ?? "");
  const retry = headers.get("Retry-After");
  const retryAt = retry && /^\d+$/.test(retry) ? now.getTime() + Number(retry) * 1000 : Date.parse(retry ?? "");
  return new Date(Math.max(now.getTime() + MIN_REFRESH_MS, Number.isFinite(expires) ? expires : 0, Number.isFinite(retryAt) && retryAt <= 8640000000000000 ? retryAt : 0)).toISOString();
}
async function readBody(response: Response): Promise<unknown> {
  if (Number(response.headers.get("Content-Length")) > MAX_BODY_BYTES || !response.body) throw new Error("Invalid weather body size");
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) { await reader.cancel(); throw new Error("Weather body too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
async function updateCache(park: OperationalParkId): Promise<void> {
  const pool = getOperationalCatalogPool(); const key = [park, COORDINATES.latitude, COORDINATES.longitude]; const token = randomUUID();
  await pool.query("INSERT INTO weather_forecast_cache (parque,latitude,longitude,source) VALUES ($1,$2,$3,'MET Norway') ON CONFLICT DO NOTHING", key);
  // Reserve the entire minimum interval before network I/O, including crashes and failed requests.
  const claimed = (await pool.query<CacheRow>(`UPDATE weather_forecast_cache SET attempted_at=clock_timestamp(),next_refresh_at=clock_timestamp()+interval '3 hours',
    lease_token=$4,lease_until=clock_timestamp()+interval '30 seconds' WHERE ${CACHE_KEY} AND next_refresh_at<=clock_timestamp()
    AND (lease_until IS NULL OR lease_until<=clock_timestamp()) RETURNING ${CACHE_COLUMNS}`, [...key, token])).rows[0];
  if (!claimed) return;
  let headers = new Headers();
  try {
    const response = await fetch(URL, { headers: { "User-Agent": "ClubeRincaoGestao/1.0 (https://cluberincao.com.br)", Accept: "application/json",
      ...(claimed.lastModified && claimed.payload ? { "If-Modified-Since": claimed.lastModified } : {}) }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
    headers = response.headers;
    if (response.status !== 200 && response.status !== 304) { await response.body?.cancel(); throw new Error("Weather provider unavailable"); }
    const now = new Date(); const payload = response.status === 304 ? claimed.payload : parseWeatherForecast(await readBody(response), now);
    if (!payload || (claimed.payload && payload.modelUpdatedAt < claimed.payload.modelUpdatedAt)) throw new Error("Missing or regressed weather response");
    const modified = headers.get("Last-Modified");
    const lastModified = modified && iso(modified) ? new Date(modified).toUTCString() : claimed.lastModified;
    await pool.query(`UPDATE weather_forecast_cache SET payload=$5::jsonb,queried_at=$6,model_updated_at=$7,last_modified=$8,
      next_refresh_at=GREATEST(next_refresh_at,$9::timestamptz),last_error=NULL,lease_token=NULL,lease_until=NULL WHERE ${CACHE_KEY} AND lease_token=$4`,
    [...key, token, JSON.stringify(payload), now.toISOString(), payload.modelUpdatedAt, lastModified, weatherNextRefreshAt(now, headers)]);
  } catch {
    await pool.query(`UPDATE weather_forecast_cache SET last_error='provider_unavailable',next_refresh_at=GREATEST(next_refresh_at,$5::timestamptz),
      lease_token=NULL,lease_until=NULL WHERE ${CACHE_KEY} AND lease_token=$4`, [...key, token, weatherNextRefreshAt(new Date(), headers)]);
  }
}

export async function refreshWeatherForecast(date: string): Promise<WeatherForecastDTO> {
  datesInput([date]); const park = getOperationalParkId();
  if (park !== "rincao") return getCachedWeatherForecast(date, park);
  const pool = getOperationalCatalogPool();
  if (!withinHorizon(date, new Date())) return getCachedWeatherForecast(date, park, pool);
  const closed = (await pool.query("SELECT estado='closed' AS closed FROM operacao_dias WHERE parque=$1 AND data=$2::date", [park, date])).rows[0]?.closed;
  if (closed) return getCachedWeatherForecast(date, park, pool);
  await updateCache(park);
  const client = await pool.connect(); let discard = false;
  try {
    await client.query("BEGIN");
    try {
      await lockOperationalDay(client, park, date);
      const closedNow = (await client.query("SELECT estado='closed' AS closed FROM operacao_dias WHERE parque=$1 AND data=$2::date FOR UPDATE", [park, date])).rows[0]?.closed;
      if (!closedNow && withinHorizon(date, new Date())) {
        const cache = (await client.query<CacheRow>(`SELECT ${CACHE_COLUMNS} FROM weather_forecast_cache WHERE ${CACHE_KEY}`, [park, COORDINATES.latitude, COORDINATES.longitude])).rows[0];
        if (cache?.payload && !cache.lastError && !cache.refreshPending) {
          const snapshot = selectForecast(cache, date, new Date());
          if (snapshot.status === "available") await client.query(`INSERT INTO weather_forecast_days (parque,data,latitude,longitude,source,queried_at,model_updated_at,snapshot)
            VALUES ($1,$2::date,$3,$4,'MET Norway',$5,$6,$7::jsonb) ON CONFLICT (parque,data) DO UPDATE SET latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,
            source=EXCLUDED.source,queried_at=EXCLUDED.queried_at,model_updated_at=EXCLUDED.model_updated_at,snapshot=EXCLUDED.snapshot
            WHERE weather_forecast_days.model_updated_at<=EXCLUDED.model_updated_at`, [park, date, COORDINATES.latitude, COORDINATES.longitude, snapshot.queriedAt, snapshot.modelUpdatedAt, JSON.stringify(snapshot)]);
        }
      }
      const result = await getCachedWeatherForecast(date, park, client); await client.query("COMMIT"); return result;
    } catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
  } finally { client.release(discard); }
}
