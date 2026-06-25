import type { Metadata } from "next";
import { PainelCompraDetailPage } from "@/components/painel-compra-detail-page";
import { getPainelPurchaseDetail } from "@/lib/painel-compras";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Detalhe da Compra | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelCompraDetailRoute({
  params,
}: {
  params: Promise<{ purchaseId: string }>;
}) {
  const session = await requirePainelAccess("vis_compra", "/painel/compras");
  const routeParams = await params;
  const detail = await getPainelPurchaseDetail(Number(routeParams.purchaseId));

  return (
    <PainelCompraDetailPage
      actorCpf={session.actorCpf}
      actorName={session.actorName}
      canManageHistory={session.legacyRoleId === 1}
      detail={detail}
    />
  );
}
