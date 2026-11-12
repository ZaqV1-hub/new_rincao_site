import { redirect } from "next/navigation";
import { getCashSession } from "@/lib/operational-cash-session";
import { getSaoPauloToday } from "@/lib/operational-date";
import type { Metadata } from "next";
import { PainelBilheteriaPageHeader } from "@/components/painel-bilheteria-page-header";
import { PainelBilheteriaSaleFinalize } from "@/components/painel-bilheteria-sale-finalize";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Finalizar Compra | Rincao",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelBilheteriaFinalizePage({ searchParams }: { searchParams?: Promise<{ periodId?: string }> }) {
  const session = await requirePainelAccess("vis_bilhet", "/painel/bilheteria/finalizar");

  const periodId = Number((await searchParams)?.periodId);
  if (!Number.isSafeInteger(periodId) || periodId <= 0) redirect("/painel/caixas");
  const cash = await getCashSession(periodId);
  if (cash.type !== "sales") redirect(`/painel/caixas/${periodId}`);
  const readOnly = Boolean(cash.closedAt) || cash.date !== getSaoPauloToday();
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

      <PainelBilheteriaSaleFinalize periodId={periodId} readOnly={readOnly} />
    </div>
  );
}

