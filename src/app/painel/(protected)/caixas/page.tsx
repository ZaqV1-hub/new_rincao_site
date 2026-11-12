import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { PainelCashSessionsPage } from "@/components/painel-cash-sessions-page";
import { getSaoPauloToday, isCivilDate } from "@/lib/operational-date";
import { listCashSessions } from "@/lib/operational-cash-session";
import { listPainelCashLocations } from "@/lib/painel-cash-locations";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata = { title: "Caixas por local | Painel Rincão", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function CashSessionsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const session = await requirePainelAccess("vis_bilhet", "/painel/caixas");
  if (session.authSource !== "panel") redirect("/painel/login?redirect=%2Fpainel%2Fcaixas");
  const today = getSaoPauloToday(), date = (await searchParams).date ?? today;
  if (!isCivilDate(date)) notFound();
  let data;
  try {
    data = await Promise.all([listCashSessions(date), listPainelCashLocations()]);
  } catch {
    return <section className="space-y-3"><h1 className="text-2xl font-bold">Caixas por local</h1><p role="alert">Não foi possível consultar os caixas. Nenhuma abertura foi solicitada.</p><Link className="inline-flex min-h-11 items-center underline" href={`/painel/caixas?date=${date}`}>Tentar consultar novamente</Link></section>;
  }
  const [sessions, locations] = data;
  return <PainelCashSessionsPage key={date} date={date} today={today} sessions={sessions} locations={locations} />;
}
