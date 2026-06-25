import type { Metadata } from "next";
import { PainelTabelaPrecoFormPage } from "@/components/painel-tabela-preco-form-page";
import { getPainelTabelaPreco } from "@/lib/painel-tabela-preco";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Editar Tabela de Preco | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelEditarTabelaPrecoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePainelAccess("vis_tabpre", "/painel/tabela-preco");
  const { id } = await params;
  const table = await getPainelTabelaPreco(id);

  return (
    <PainelTabelaPrecoFormPage
      legacyResources={session.legacyResources}
      mode="edit"
      table={table}
    />
  );
}
