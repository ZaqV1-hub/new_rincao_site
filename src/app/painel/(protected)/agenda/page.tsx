import type { Metadata } from "next";
import { PainelAgendaManager } from "@/components/painel-agenda-manager";
import { getPainelAgendaScreenData } from "@/lib/painel-agenda";
import { requirePainelAccess } from "@/lib/painel-session";
import { listOperationalDays, OperationalDayError, type OperationalDay } from "@/lib/operational-day";
import { getSaoPauloToday } from "@/lib/operational-date";
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
  let operationalDays: OperationalDay[] | null = null;
  let operationalError: string | null = null;
  try {
    operationalDays = await listOperationalDays(dates[0].date, dates[dates.length - 1].date);
  } catch (error) {
    operationalError = error instanceof OperationalDayError ? error.message : "Não foi possível consultar a programação. Tente atualizar em instantes.";
  }

  return (
    <PainelAgendaManager
      key={`${data.year}-${data.month}-${data.selectedDate ?? "none"}`}
      data={data}
      operationalDays={operationalDays}
      operationalError={operationalError}
      today={getSaoPauloToday()}
      canEdit={session.authSource === "panel" && session.legacyRoleId === 1}
    />
  );
}

