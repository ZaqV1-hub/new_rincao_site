import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  loadPainelBilheteriaPurchaseDetailFromParams,
  requirePainelBilheteriaHistorySession,
} from "@/lib/painel-bilheteria-page";

export const metadata: Metadata = {
  title: "Painel - Editar Venda | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelBilheteriaHistoricoEditPage({
  params,
}: {
  params: Promise<{
    purchaseId: string;
  }>;
}) {
  await requirePainelBilheteriaHistorySession();
  const { purchaseId, detail } =
    await loadPainelBilheteriaPurchaseDetailFromParams(params);

  if (detail.status === "canc") {
    redirect(`/painel/bilheteria/historico?purchase=${purchaseId}`);
  }

  redirect(`/painel/bilheteria/historico?purchase=${purchaseId}&mode=edit`);
}
