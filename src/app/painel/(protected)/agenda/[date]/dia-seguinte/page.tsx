import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PainelDayProgramPage } from "@/components/painel-day-program-page";
import { DayProgramError, getDayProgram } from "@/lib/day-program";
import { getDayProgramNavigation } from "@/lib/day-program-navigation";
import { isCivilDate } from "@/lib/operational-date";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = { title: "Dia seguinte | Painel Rincão", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PainelDayProgramRoute({ params, searchParams }: { params: Promise<{ date: string }>; searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const session = await requirePainelAccess("vis_agenda", "/painel/agenda");
  if (session.authSource !== "panel") redirect("/painel/login?redirect=%2Fpainel%2Fagenda");
  await requirePainelAccess(["vis_clientes", "vis_escola"], "/painel/agenda");
  const { date } = await params;
  if (!isCivilDate(date)) notFound();
  const { returnTo } = await searchParams;
  const returnDate = typeof returnTo === "string" && isCivilDate(returnTo) ? returnTo : date;
  let program, navigation;
  try {
    [program, navigation] = await Promise.all([getDayProgram(date), getDayProgramNavigation(date)]);
  } catch (error) {
    const message = error instanceof DayProgramError ? error.message : "Não foi possível consultar a programação. Atualize a página para tentar novamente.";
    return <section className="space-y-4 text-[#123b63]"><h1 className="text-2xl font-bold">Dia seguinte · {date.split("-").reverse().join("/")}</h1><p role="alert">{message}</p><Link href={`/painel/agenda/${returnDate}`} className="inline-flex min-h-11 items-center underline">Voltar à data</Link></section>;
  }
  return <PainelDayProgramPage key={date} program={program} navigation={navigation} canManage={session.legacyRoleId === 1} returnDate={returnDate} />;
}
