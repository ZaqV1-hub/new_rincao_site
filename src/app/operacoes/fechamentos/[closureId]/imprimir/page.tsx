import type { Metadata } from "next";
import { CashClosurePrintView } from "@/components/cash-closure-print-view";
import { loadCashClosurePrintModel } from "@/lib/ops-cash-print-route";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    closureId: string;
  }>;
};

export const metadata: Metadata = {
  title: "Impressao de Fechamento | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function OperacoesFechamentoImprimirPage({
  params,
}: PageProps) {
  const { closureId } = await params;
  const model = await loadCashClosurePrintModel(closureId);

  return <CashClosurePrintView model={model} />;
}
