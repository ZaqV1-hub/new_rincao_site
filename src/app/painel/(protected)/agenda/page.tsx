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

export default async function PainelAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{
    mes?: string;
    ano?: string;
    dia?: string;
  }>;
}) {
  await requirePainelAccess("vis_agenda", "/painel/agenda");
  const params = await searchParams;
  const data = await getPainelAgendaScreenData({
    month: params.mes,
    year: params.ano,
    selectedDate: params.dia,
  });

  return (
    <PainelAgendaManager
      key={`${data.year}-${data.month}-${data.selectedDate ?? "none"}`}
      data={data}
    />
  );
}
