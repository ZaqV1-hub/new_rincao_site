import { afterEach, describe, expect, it, vi } from "vitest";
import { getCachedWeatherForecasts, parseWeatherForecast, weatherNextRefreshAt } from "./weather-forecast";

vi.mock("@/lib/painel-operational-catalog", () => ({ getOperationalCatalogPool: () => { throw new Error("Unexpected database access"); } }));
const now = new Date("2026-11-12T13:00:00Z");
function payload(symbol: unknown = "partlycloudy_day", temperature: unknown = 23.4) {
  return { geometry: { coordinates: [-46.7475, -23.7769, 750] }, properties: {
    meta: { updated_at: "2026-11-12T12:00:00Z", units: { air_temperature: "celsius" } },
    timeseries: [{ time: "2026-11-12T15:00:00Z", data: { instant: { details: { air_temperature: temperature } }, next_6_hours: { summary: { symbol_code: symbol } } } }],
  } };
}
afterEach(() => vi.useRealTimers());
describe("MET weather contract", () => {
  it("keeps instant temperatures and the provider's condition period, never fabricates min/max", () => {
    expect(parseWeatherForecast(payload(), now)).toEqual({ modelUpdatedAt: "2026-11-12T12:00:00.000Z", points: [{ time: "2026-11-12T15:00:00.000Z", temperatureC: 23.4, condition: "parcialmente nublado", periodHours: 6 }] });
    expect(parseWeatherForecast(payload("rainandthunder_night"), now).points[0].condition).toBe("chuva com trovoadas");
  });
  it("retains known temperature when symbol is unknown or absent", () => {
    for (const symbol of ["new_unknown_symbol", null]) expect(parseWeatherForecast(payload(symbol), now).points[0]).toMatchObject({ temperatureC: 23.4, condition: null });
  });
  it("rejects malformed data, wrong coordinates/units, invalid temperatures and future model timestamps", () => {
    for (const input of [null, {}, payload("rain", null), payload("rain", "23"), payload("rain", 100)]) expect(() => parseWeatherForecast(input, now)).toThrow();
    const wrongUnits = payload(); wrongUnits.properties.meta.units.air_temperature = "fahrenheit";
    const wrongCoords = payload(); wrongCoords.geometry.coordinates[0] = 0;
    const future = payload(); future.properties.meta.updated_at = "2026-11-13T13:00:00Z";
    const duplicate = payload(); duplicate.properties.timeseries.push(duplicate.properties.timeseries[0]);
    const impossibleTime = payload(); impossibleTime.properties.timeseries[0].time = "2026-02-30T15:00:00Z";
    const nanCoords = payload(); nanCoords.geometry.coordinates[0] = NaN;
    for (const input of [wrongUnits, wrongCoords, future, duplicate, impossibleTime, nanCoords]) expect(() => parseWeatherForecast(input, now)).toThrow();
  });
  it("honors the longest of minimum 3h, Expires and Retry-After", () => {
    expect(weatherNextRefreshAt(now, new Headers())).toBe("2026-11-12T16:00:00.000Z");
    expect(weatherNextRefreshAt(now, new Headers({ Expires: "Thu, 12 Nov 2026 14:00:00 GMT" }))).toBe("2026-11-12T16:00:00.000Z");
    expect(weatherNextRefreshAt(now, new Headers({ Expires: "Thu, 12 Nov 2026 20:00:00 GMT" }))).toBe("2026-11-12T20:00:00.000Z");
    expect(weatherNextRefreshAt(now, new Headers({ "Retry-After": "14400" }))).toBe("2026-11-12T17:00:00.000Z");
    expect(weatherNextRefreshAt(now, new Headers({ "Retry-After": "Thu, 12 Nov 2026 22:00:00 GMT" }))).toBe("2026-11-12T22:00:00.000Z");
    expect(weatherNextRefreshAt(now, new Headers({ Expires: "invalid", "Retry-After": "9".repeat(500) }))).toBe("2026-11-12T16:00:00.000Z");
  });
  it("disables unverified Estância and validates civil dates/batch size before database use", async () => {
    expect(await getCachedWeatherForecasts(["2026-11-12"], "estancia")).toMatchObject({ "2026-11-12": { status: "unavailable", reason: expect.stringContaining("Estância") } });
    expect(await getCachedWeatherForecasts([], "rincao")).toEqual({});
    await expect(getCachedWeatherForecasts(["2026-02-30"])).rejects.toMatchObject({ code: "invalid_input" });
    await expect(getCachedWeatherForecasts(Array(32).fill("2026-11-12"))).rejects.toMatchObject({ code: "invalid_input" });
  });
});
