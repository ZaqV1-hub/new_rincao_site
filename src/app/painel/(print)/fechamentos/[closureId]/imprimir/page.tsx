import type { Metadata } from "next";
import { CashClosurePrintView } from "@/components/cash-closure-print-view";
import { loadCashClosurePrintModel } from "@/lib/ops-cash-print-route";
import { requirePainelAccess } from "@/lib/painel-session";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    closureId: string;
  }>;
};

export const metadata: Metadata = {
  title: "Painel - Impressao de Fechamento | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PainelFechamentoImprimirPage({
  params,
}: PageProps) {
  await requirePainelAccess(
    ["vis_bilhet", "vis_compra"],
    "/painel/fechamentos/imprimir",
  );

  const { closureId } = await params;
  const model = await loadCashClosurePrintModel(closureId);

  return <CashClosurePrintView model={model} />;
}
