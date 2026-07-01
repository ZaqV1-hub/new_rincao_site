import type { Metadata } from "next";
import { PainelBilheteriaPageHeader } from "@/components/painel-bilheteria-page-header";
import { PainelBilheteriaSalesBuilder } from "@/components/painel-bilheteria-sales-builder";
import { getBilheteriaAgendaStatusToday } from "@/lib/bilheteria-agenda";
import { requirePainelAccess } from "@/lib/painel-session";
import { buildStandardTicketProducts } from "@/lib/standard-ticket-products";

export const metadata: Metadata = {
  title: "Painel - Vendas da Bilheteria | Rincao",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelBilheteriaVendasPage() {
  const session = await requirePainelAccess("vis_bilhet", "/painel/bilheteria/vendas");
  const { today, openAgendas } = await getBilheteriaAgendaStatusToday();
  const agendas = openAgendas.filter((agenda) => agenda.status === "abe");
  const agenda = agendas[0] ?? null;
  const availableProducts = agenda
    ? buildStandardTicketProducts(
        {
          siteNormal: agenda.priceTable.normal,
          siteChild: agenda.priceTable.child,
          gateNormal: agenda.priceTable.gateNormal ?? agenda.priceTable.normal,
          gateChild: agenda.priceTable.gateChild ?? agenda.priceTable.child,
        },
      )
    : [];

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
        today={today}
        agendas={agendas}
        products={availableProducts}
      />
    </div>
  );
}
