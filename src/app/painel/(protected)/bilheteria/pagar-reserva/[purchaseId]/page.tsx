import { getCashSession } from "@/lib/operational-cash-session";
import { getSaoPauloToday } from "@/lib/operational-date";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PainelBilheteriaPageHeader } from "@/components/painel-bilheteria-page-header";
import { PainelBilheteriaReservationPayment } from "@/components/painel-bilheteria-reservation-payment";
import { getPainelBilheteriaPurchaseDetail } from "@/lib/painel-bilheteria";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Pagar Reserva | Rincao",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelBilheteriaPagarReservaPage({
  params,
  searchParams,
}: {
  searchParams?: Promise<{ periodId?: string }>;
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

  const requestedPeriodId = Number((await searchParams)?.periodId);
  const periodId = Number.isSafeInteger(requestedPeriodId) && requestedPeriodId > 0 ? requestedPeriodId : undefined;
  const cash = periodId ? await getCashSession(periodId) : null;
  const readOnly = !cash || cash.type !== "sales" || Boolean(cash.closedAt) || cash.date !== getSaoPauloToday();
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

      <PainelBilheteriaReservationPayment detail={detail} periodId={periodId} readOnly={readOnly} />
    </div>
  );
}

