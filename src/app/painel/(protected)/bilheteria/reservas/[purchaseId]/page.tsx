import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PainelBilheteriaPageHeader } from "@/components/painel-bilheteria-page-header";
import { PainelBilheteriaPurchaseDetail } from "@/components/painel-bilheteria-purchase-detail";
import { getPainelBilheteriaPaymentOptions } from "@/lib/painel-bilheteria";
import { loadPainelBilheteriaPurchaseDetailFromParams } from "@/lib/painel-bilheteria-page";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Pagamento de Reserva | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelBilheteriaReservaDetailPage({
  params,
}: {
  params: Promise<{
    purchaseId: string;
  }>;
}) {
  const session = await requirePainelAccess("vis_bilhet", "/painel/bilheteria/reservas");
  const { detail } = await loadPainelBilheteriaPurchaseDetailFromParams(params);

  if (detail.type !== "reser") {
    redirect("/painel/bilheteria/reservas");
  }

  return (
    <div className="grid gap-5">
      <PainelBilheteriaPageHeader
        current="reservations"
        isManager={session.legacyRoleId === 1}
        title="Pagamento de reserva"
        description="Registre o recebimento da reserva e acompanhe os vouchers vinculados a esta compra."
      />

      <PainelBilheteriaPurchaseDetail
        detail={detail}
        actorName={session.actorName}
        actorCpf={session.actorCpf}
        returnHref="/painel/bilheteria/reservas"
        mode="reservation"
        canManageHistory={session.legacyRoleId === 1}
        paymentOptions={getPainelBilheteriaPaymentOptions()}
      />
    </div>
  );
}
