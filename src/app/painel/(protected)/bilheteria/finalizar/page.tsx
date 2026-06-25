import type { Metadata } from "next";
import { PainelBilheteriaPageHeader } from "@/components/painel-bilheteria-page-header";
import { PainelBilheteriaSaleFinalize } from "@/components/painel-bilheteria-sale-finalize";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Finalizar Compra | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelBilheteriaFinalizePage() {
  const session = await requirePainelAccess("vis_bilhet", "/painel/bilheteria/finalizar");

  return (
    <div className="grid gap-5">
      <PainelBilheteriaPageHeader
        current="finalize"
        screen="bilheteria-finalize"
        isManager={session.legacyRoleId === 1}
        title="Finalizar Compra"
        description="Confirme as formas de pagamento e conclua a venda da bilheteria."
        actorName={session.actorName}
      />

      <PainelBilheteriaSaleFinalize />
    </div>
  );
}
