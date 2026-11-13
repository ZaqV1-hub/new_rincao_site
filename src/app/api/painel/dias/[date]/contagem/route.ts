import { requirePainelApiAccess } from '@/lib/painel-api-auth';
import { getCountingDay } from '@/lib/trip-counting';
import { isCivilDate } from '@/lib/operational-date';
export const runtime = 'nodejs';
function privateResponse(response: Response) { response.headers.set('Cache-Control','private, no-store'); return response; }
export async function GET(request: Request,context: { params: Promise<{ date: string }> }) {
  try {
    const agenda = await requirePainelApiAccess(request,'vis_agenda'); if (!agenda.ok) return privateResponse(agenda.response);
    const groups = await requirePainelApiAccess(request,['vis_clientes','vis_escola']); if (!groups.ok) return privateResponse(groups.response);
    const { date } = await context.params;
    if (!isCivilDate(date) || new URL(request.url).search) return privateResponse(Response.json({ ok: false,error: { message: 'Informe uma data válida.' } },{ status: 400 }));
    return privateResponse(Response.json({ ok: true,data: await getCountingDay(date) }));
  } catch { return privateResponse(Response.json({ ok: false,error: { message: 'Contagem indisponível. Os dados anteriores podem estar desatualizados.' } },{ status: 503 })); }
}
