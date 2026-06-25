import type { Metadata } from "next";
import { PainelInformacaoDetailPage } from "@/components/painel-informacao-detail-page";
import { getPainelInformacao } from "@/lib/painel-informacoes";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Detalhe Informacao | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelInformacaoDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePainelAccess("vis_info", "/painel/informacao");
  const { id } = await params;
  const data = await getPainelInformacao(id);

  return (
    <PainelInformacaoDetailPage
      data={data}
      legacyResources={session.legacyResources}
    />
  );
}
