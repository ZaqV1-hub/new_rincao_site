import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  loadPainelBilheteriaPurchaseDetailFromParams,
  readPainelBilheteriaFlashState,
  requirePainelBilheteriaHistorySession,
} from "@/lib/painel-bilheteria-page";

export const metadata: Metadata = {
  title: "Painel - Detalhe de Venda | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelBilheteriaHistoricoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{
    purchaseId: string;
  }>;
  searchParams?: Promise<{
    success?: string;
    warning?: string | string[];
  }>;
}) {
  await requirePainelBilheteriaHistorySession();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { detail } = await loadPainelBilheteriaPurchaseDetailFromParams(params);
  const { flashSuccess, flashWarnings } =
    readPainelBilheteriaFlashState(resolvedSearchParams);
  const nextParams = new URLSearchParams({
    purchase: String(detail.purchaseId),
  });

  if (flashSuccess) {
    nextParams.set("success", flashSuccess);
  }

  for (const warning of flashWarnings) {
    nextParams.append("warning", warning);
  }

  redirect(`/painel/bilheteria/historico?${nextParams.toString()}`);
}
