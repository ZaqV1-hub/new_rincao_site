import type { Metadata } from "next";
import { PainelBilheteriaPageHeader } from "@/components/painel-bilheteria-page-header";
import { PainelBilheteriaSalesBuilder } from "@/components/painel-bilheteria-sales-builder";
import { getBilheteriaAgendaStatusToday } from "@/lib/bilheteria-agenda";
import { getAgendaProductAvailability } from "@/lib/painel-agenda-product-availability";
import { requirePainelAccess } from "@/lib/painel-session";
import { getManagedB2cProducts } from "@/lib/rincao-content-store";

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
  const products = await getManagedB2cProducts("passport");
  const { today, openAgendas } = await getBilheteriaAgendaStatusToday();
  const agendas = openAgendas.filter((agenda) => agenda.status === "abe");
  const availability = await getAgendaProductAvailability(today);
  const availableProducts = products.filter((product) =>
    availability.passportIds.includes(product.id),
  );

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
