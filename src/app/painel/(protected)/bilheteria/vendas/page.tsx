import type { Metadata } from "next";
import { PainelBilheteriaPageHeader } from "@/components/painel-bilheteria-page-header";
import { PainelBilheteriaSalesBuilder } from "@/components/painel-bilheteria-sales-builder";
import { getManagedB2cProducts } from "@/lib/estancia-content-store";
import { getPublicAgendaEvents } from "@/lib/agenda-repository";
import { getAgendaProductAvailability } from "@/lib/painel-agenda-product-availability";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Vendas da Bilheteria | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

function getSaoPauloToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

export default async function PainelBilheteriaVendasPage() {
  const session = await requirePainelAccess("vis_bilhet", "/painel/bilheteria/vendas");
  const products = await getManagedB2cProducts("passport");
  const today = getSaoPauloToday();
  const [year, month] = today.split("-").map(Number);
  const agendas = (await getPublicAgendaEvents(month, year)).filter(
    (agenda) => agenda.date === today && agenda.status === "abe",
  );
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
