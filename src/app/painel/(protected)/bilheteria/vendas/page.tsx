import type { Metadata } from "next";
import { PainelBilheteriaPageHeader } from "@/components/painel-bilheteria-page-header";
import { PainelBilheteriaSalesBuilder } from "@/components/painel-bilheteria-sales-builder";
import { getBilheteriaAgendaStatusToday } from "@/lib/bilheteria-agenda";
import { requirePainelAccess } from "@/lib/painel-session";
import { loadOperationalDayOffer } from "@/lib/operational-day-offer";
import { getCashSession } from "@/lib/operational-cash-session";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Painel - Vendas da Bilheteria | Rincao",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelBilheteriaVendasPage({ searchParams }: { searchParams?: Promise<{ periodId?: string }> }) {
  const session = await requirePainelAccess("vis_bilhet", "/painel/bilheteria/vendas");
  const periodId = Number((await searchParams)?.periodId);
  if (!Number.isSafeInteger(periodId) || periodId <= 0) redirect("/painel/caixas");
  const cash = await getCashSession(periodId);
  const { today, openAgendas } = await getBilheteriaAgendaStatusToday();
  if (cash.type !== "sales" || cash.closedAt || cash.date !== today) redirect(`/painel/caixas/${periodId}`);
  const agendas = openAgendas;
  const agenda = agendas[0] ?? null;
  const availableProducts = agenda ? (await loadOperationalDayOffer(agenda, undefined, "gate")).products : [];

  return (
    <div className="grid gap-5">
      <PainelBilheteriaPageHeader
        current="sales"
        screen="bilheteria-sales"
        isManager={session.legacyRoleId === 1}
        title="Vendas"
        description="Monte a compra, aplique descontos e cortesias, e siga para a finalização do pagamento."
        actorName={session.actorName}
      />

      <PainelBilheteriaSalesBuilder
        periodId={periodId}
        today={today}
        agendas={agendas}
        products={availableProducts}
      />
    </div>
  );
}
