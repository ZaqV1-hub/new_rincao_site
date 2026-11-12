import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PainelOperationalDayPage } from "@/components/painel-operational-day-page";
import { OperationalDayError } from "@/lib/operational-day";
import { getOperationalDaySummary, OperationalDaySummaryError } from "@/lib/operational-day-summary";
import { isCivilDate } from "@/lib/operational-date";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = { title: "Resumo da data | Painel Rincão", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PainelAgendaDayPage({ params }: { params: Promise<{ date: string }> }) {
  const session = await requirePainelAccess("vis_agenda", "/painel/agenda");
  if (session.authSource !== "panel") redirect("/painel/login?redirect=%2Fpainel%2Fagenda");
  const { date } = await params;
  if (!isCivilDate(date)) notFound();
  let summary;
  try {
    summary = await getOperationalDaySummary(date);
  } catch (error) {
    const message = error instanceof OperationalDayError || error instanceof OperationalDaySummaryError
      ? error.message : "Não foi possível consultar o resumo. Atualize a página para tentar novamente.";
    return <section className="space-y-4 text-[#123b63]"><h1 className="text-2xl font-bold">Resumo de {date.split("-").reverse().join("/")}</h1><p role="alert">{message}</p><Link href={`/painel/agenda?mes=${Number(date.slice(5, 7))}&ano=${date.slice(0, 4)}&dia=${date}`} className="underline">Voltar ao calendário</Link></section>;
  }
  return <PainelOperationalDayPage key={date} summary={summary} canManage={session.legacyRoleId === 1} />;
}
