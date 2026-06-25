import type { Metadata } from "next";
import { PainelTabelaPrecoDetailPage } from "@/components/painel-tabela-preco-detail-page";
import { getPainelTabelaPreco } from "@/lib/painel-tabela-preco";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Detalhe Tabela de Preco | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelTabelaPrecoDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePainelAccess("vis_tabpre", "/painel/tabela-preco");
  const { id } = await params;
  const data = await getPainelTabelaPreco(id);

  return (
    <PainelTabelaPrecoDetailPage
      data={data}
      legacyResources={session.legacyResources}
    />
  );
}
