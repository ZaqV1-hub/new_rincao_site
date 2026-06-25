import type { Metadata } from "next";
import { PainelCompraGatewayStatusPage } from "@/components/painel-compra-gateway-status-page";
import {
  getPainelPurchaseDetail,
  getPainelPurchaseGatewayConsult,
} from "@/lib/painel-compras";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Consulta Pagamento | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelCompraGatewayStatusRoute({
  params,
}: {
  params: Promise<{ purchaseId: string }>;
}) {
  await requirePainelAccess("vis_compra", "/painel/compras");
  const routeParams = await params;
  const purchaseId = Number(routeParams.purchaseId);
  const [detail, consult] = await Promise.all([
    getPainelPurchaseDetail(purchaseId),
    getPainelPurchaseGatewayConsult(purchaseId),
  ]);

  return <PainelCompraGatewayStatusPage consult={consult} detail={detail} />;
}
