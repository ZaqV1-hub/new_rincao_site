import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { hasLegacyPanelResource } from "@/lib/painel-access";
import { readPurchaseReturnContext, type PurchaseNavigationQuery } from "@/lib/operational-purchase-navigation";
import { PainelCompraDetailPage } from "@/components/painel-compra-detail-page";
import { getPainelPurchaseDetail } from "@/lib/painel-compras";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Detalhe da Compra | Rincao",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelCompraDetailRoute({
  params, searchParams,
}: {
  params: Promise<{ purchaseId: string }>;
  searchParams?: Promise<PurchaseNavigationQuery>;
}) {
  const session = await requirePainelAccess("vis_compra", "/painel/compras");
  if (session.authSource !== "panel") redirect("/painel/login?redirect=%2Fpainel%2Fcompras");
  const routeParams = await params;
  if (!/^[1-9]\d*$/.test(routeParams.purchaseId) || !Number.isSafeInteger(Number(routeParams.purchaseId))) notFound();
  const detail = await getPainelPurchaseDetail(Number(routeParams.purchaseId));

  return (
    <PainelCompraDetailPage
      key={Number(routeParams.purchaseId)}
      canOperateVouchers={hasLegacyPanelResource(session.legacyResources, "vis_bilhet")}
      actorCpf={session.actorCpf}
      actorName={session.actorName}
      detail={detail}
      returnContext={readPurchaseReturnContext(await searchParams ?? {})}
      canAccessCustomer={hasLegacyPanelResource(session.legacyResources, "vis_situsu")}
      canAccessSchool={hasLegacyPanelResource(session.legacyResources, ["vis_clientes", "vis_escola"])}
    />
  );
}

