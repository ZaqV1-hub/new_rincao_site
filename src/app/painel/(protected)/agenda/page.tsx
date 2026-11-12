import type { Metadata } from "next";
import { PainelAgendaManager } from "@/components/painel-agenda-manager";
import { getPainelAgendaScreenData } from "@/lib/painel-agenda";
import { requirePainelAccess } from "@/lib/painel-session";
import { listOperationalDays, OperationalDayError, type OperationalDay } from "@/lib/operational-day";
import { getSaoPauloToday } from "@/lib/operational-date";
import { getDayPrograms, type DayProgram } from "@/lib/day-program";
import { hasLegacyPanelResource } from "@/lib/painel-access";
import { buildPainelAgendaCalendar } from "@/lib/painel-agenda-ui";

export const metadata: Metadata = {
  title: "Painel - Agenda | Rincao",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{
    mes?: string;
    ano?: string;
    dia?: string;
  }>;
}) {
  const session = await requirePainelAccess("vis_agenda", "/painel/agenda");
  const params = await searchParams;
  const data = await getPainelAgendaScreenData({
    month: params.mes,
    year: params.ano,
    selectedDate: params.dia,
  });

  const dates = buildPainelAgendaCalendar(data.month, data.year).filter((cell) => cell.inMonth);
  const canAccessProgram = session.authSource === "panel" && hasLegacyPanelResource(session.legacyResources, "vis_agenda")
    && hasLegacyPanelResource(session.legacyResources, ["vis_clientes", "vis_escola"]);
  let programStatuses: Record<string, DayProgram["status"]> | null = null;
  let programError: string | null = null;
  let operationalDays: OperationalDay[] | null = null;
  let operationalError: string | null = null;
  const [configuration, programs] = await Promise.allSettled([
    listOperationalDays(dates[0].date, dates[dates.length - 1].date),
    canAccessProgram ? getDayPrograms(dates.map((cell) => cell.date)) : Promise.resolve(null),
  ]);
  if (configuration.status === "fulfilled") operationalDays = configuration.value;
  else operationalError = configuration.reason instanceof OperationalDayError ? configuration.reason.message : "Não foi possível consultar a programação. Tente atualizar em instantes.";
  if (programs.status === "fulfilled" && programs.value !== null) programStatuses = Object.fromEntries(programs.value.map(({ date, status }) => [date, status]));
  else if (canAccessProgram) programError = "Programação do dia indisponível. Atualize a página para tentar novamente.";

  return (
    <PainelAgendaManager
      key={`${data.year}-${data.month}-${data.selectedDate ?? "none"}`}
      data={data}
      operationalDays={operationalDays}
      operationalError={operationalError}
      canAccessProgram={canAccessProgram}
      programStatuses={programStatuses}
      programError={programError}
      today={getSaoPauloToday()}
      canEdit={session.authSource === "panel" && session.legacyRoleId === 1}
    />
  );
}

