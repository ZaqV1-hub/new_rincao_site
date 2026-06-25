import type { Metadata } from "next";
import { CashClosurePrintView } from "@/components/cash-closure-print-view";
import { loadCurrentCashClosurePrintModel } from "@/lib/ops-cash-print-route";
import { requirePainelAccess } from "@/lib/painel-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Painel - Impressao de Fechamento | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PainelFechamentoAtualImprimirPage() {
  await requirePainelAccess(
    ["vis_bilhet", "vis_compra"],
    "/painel/fechamentos/imprimir",
  );

  const model = await loadCurrentCashClosurePrintModel();

  return <CashClosurePrintView model={model} />;
}
