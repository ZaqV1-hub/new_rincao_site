import type { Metadata } from "next";
import { PainelTabelaPrecoPage } from "@/components/painel-tabela-preco-page";
import { listPainelTabelaPreco } from "@/lib/painel-tabela-preco";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Tabela de Preco | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelTabelaPrecoPageRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePainelAccess("vis_tabpre", "/painel/tabela-preco");
  const query = await searchParams;
  const data = await listPainelTabelaPreco(query);

  return (
    <PainelTabelaPrecoPage
      data={data}
      legacyResources={session.legacyResources}
    />
  );
}
