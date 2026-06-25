import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PainelBilheteriaPageHeader } from "@/components/painel-bilheteria-page-header";
import { PainelBilheteriaReservationPayment } from "@/components/painel-bilheteria-reservation-payment";
import { getPainelBilheteriaPurchaseDetail } from "@/lib/painel-bilheteria";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Pagar Reserva | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelBilheteriaPagarReservaPage({
  params,
}: {
  params: Promise<{
    purchaseId: string;
  }>;
}) {
  const session = await requirePainelAccess("vis_bilhet", "/painel/bilheteria/pagar-reserva");
  const { purchaseId } = await params;
  const detail = await getPainelBilheteriaPurchaseDetail(Number(purchaseId));

  if (!detail || detail.type !== "reser") {
    notFound();
  }

  return (
    <div className="grid gap-5">
      <PainelBilheteriaPageHeader
        current="reservation-payment"
        screen="bilheteria-reservation-payment"
        isManager={session.legacyRoleId === 1}
        title="Pagar Reserva"
        description="Conclua o pagamento da reserva com múltiplas formas quando necessário."
        actorName={session.actorName}
      />

      <PainelBilheteriaReservationPayment detail={detail} />
    </div>
  );
}
