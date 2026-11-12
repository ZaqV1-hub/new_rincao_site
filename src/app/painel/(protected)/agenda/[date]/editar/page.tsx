import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PainelDayUseEditor } from "@/components/painel-day-use-editor";
import { getOperationalDay, OperationalDayError } from "@/lib/operational-day";
import { isCivilDate } from "@/lib/operational-date";
import { listPainelServices } from "@/lib/painel-services";
import { listPainelAgendaPriceTables } from "@/lib/painel-agenda";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = { title: "Day use | Painel Rincão", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PainelAgendaEditPage({ params }: { params: Promise<{ date: string }> }) {
  const session = await requirePainelAccess("vis_agenda", "/painel/agenda");
  if (session.authSource !== "panel") redirect("/painel/login?redirect=%2Fpainel%2Fagenda");
  const { date } = await params;
  if (!isCivilDate(date)) notFound();
  let data;
  try {
    data = await Promise.all([getOperationalDay(date), listPainelAgendaPriceTables(), listPainelServices()]);
  } catch (error) {
    if (!(error instanceof OperationalDayError)) throw error;
    return <div className="space-y-4 text-[#123b63]"><h1 className="text-2xl font-bold">Programação da data</h1><p role="alert">{error.message}</p><Link href="/painel/agenda" className="underline">Voltar à agenda</Link></div>;
  }
  return <PainelDayUseEditor day={data[0]} priceTables={data[1]} services={data[2]} canEdit={session.legacyRoleId === 1} />;
}
