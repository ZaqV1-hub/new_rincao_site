import type { Metadata } from "next";
import { PainelAgendaManager } from "@/components/painel-agenda-manager";
import { getPainelAgendaScreenData } from "@/lib/painel-agenda";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Agenda | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelAgendaDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{
    mes?: string;
    ano?: string;
  }>;
}) {
  await requirePainelAccess("vis_agenda", "/painel/agenda");
  const routeParams = await params;
  const queryParams = await searchParams;
  const data = await getPainelAgendaScreenData({
    month: queryParams.mes,
    year: queryParams.ano,
    selectedDate: routeParams.date,
  });

  return (
    <PainelAgendaManager
      key={`${data.year}-${data.month}-${data.selectedDate ?? "none"}`}
      data={data}
    />
  );
}
