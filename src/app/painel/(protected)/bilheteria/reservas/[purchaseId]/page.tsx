import { getCashSession } from "@/lib/operational-cash-session";
import { getSaoPauloToday } from "@/lib/operational-date";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PainelBilheteriaPageHeader } from "@/components/painel-bilheteria-page-header";
import { PainelBilheteriaPurchaseDetail } from "@/components/painel-bilheteria-purchase-detail";
import { getPainelBilheteriaPaymentOptions } from "@/lib/painel-bilheteria";
import { loadPainelBilheteriaPurchaseDetailFromParams } from "@/lib/painel-bilheteria-page";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Pagamento de Reserva | Rincao",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelBilheteriaReservaDetailPage({
  params,
  searchParams,
}: {
  searchParams?: Promise<{ periodId?: string }>;
  params: Promise<{
    purchaseId: string;
  }>;
}) {
  const session = await requirePainelAccess("vis_bilhet", "/painel/bilheteria/reservas");
  const { detail } = await loadPainelBilheteriaPurchaseDetailFromParams(params);

  if (detail.type !== "reser") {
    redirect("/painel/bilheteria/reservas");
  }

  const requestedPeriodId = Number((await searchParams)?.periodId);
  const periodId = Number.isSafeInteger(requestedPeriodId) && requestedPeriodId > 0 ? requestedPeriodId : undefined;
  const cash = periodId ? await getCashSession(periodId) : null;
  const readOnly = !cash || cash.type !== "sales" || Boolean(cash.closedAt) || cash.date !== getSaoPauloToday();
  return (
    <div className="grid gap-5">
      <PainelBilheteriaPageHeader
        current="reservations"
        isManager={session.legacyRoleId === 1}
        title="Pagamento de reserva"
        description="Registre o recebimento da reserva e acompanhe os vouchers vinculados a esta compra."
      />

      <PainelBilheteriaPurchaseDetail
        periodId={periodId}
        readOnly={readOnly}
        detail={detail}
        actorName={session.actorName}
        actorCpf={session.actorCpf}
        returnHref={periodId ? `/painel/caixas/${periodId}?tab=reservas` : "/painel/bilheteria/reservas"}
        mode="reservation"
        canManageHistory={session.legacyRoleId === 1}
        paymentOptions={getPainelBilheteriaPaymentOptions()}
      />
    </div>
  );
}

