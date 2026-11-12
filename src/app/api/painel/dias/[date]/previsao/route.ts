import { isCivilDate } from "@/lib/operational-date";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import { opsErrorResponse } from "@/lib/ops-route-utils";
import { getCachedWeatherForecast, refreshWeatherForecast, WeatherForecastError } from "@/lib/weather-forecast";

type Context = { params: Promise<{ date: string }> };
function privateResponse(response: Response) { response.headers.set("Cache-Control", "private, no-store"); return response; }
async function requireEmptyBody(request: Request) {
  if (!request.body) return;
  const reader = request.body.getReader();
  const invalid = () => new WeatherForecastError("A atualização não aceita corpo ou configurações do cliente.");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(invalid()), 2000); });
  try {
    for (let chunks = 0; chunks < 32; chunks++) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) return;
      if (value.byteLength) throw invalid();
    }
    throw invalid();
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
async function run(request: Request, context: Context, method: "GET" | "POST") {
  try {
    const access = await requirePainelApiAccess(request, "vis_agenda");
    if (!access.ok) return privateResponse(access.response);
    const { date } = await context.params;
    if (!isCivilDate(date) || new URL(request.url).search) throw new WeatherForecastError("Informe uma data civil válida, sem parâmetros adicionais.");
    if (method === "POST") {
      if (access.session.legacyRoleId !== 1) return privateResponse(opsErrorResponse("painel_forbidden", "Apenas gerentes podem atualizar a previsão.", 403));
      await requireEmptyBody(request);
    }
    return privateResponse(Response.json({ ok: true, data: await (method === "POST" ? refreshWeatherForecast(date) : getCachedWeatherForecast(date)) }));
  } catch (error) {
    if (error instanceof WeatherForecastError) return privateResponse(opsErrorResponse(error.code, error.message, 400));
    console.error("[painel-weather]", error instanceof Error ? error.name : "Unknown error");
    return privateResponse(opsErrorResponse("weather_unavailable", "Não foi possível acessar a previsão.", 503));
  }
}
export function GET(request: Request, context: Context) { return run(request, context, "GET"); }
export function POST(request: Request, context: Context) { return run(request, context, "POST"); }
