import type { Metadata } from "next";
import { PainelTabelaPrecoFormPage } from "@/components/painel-tabela-preco-form-page";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Adicionar Tabela de Preco | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PainelAdicionarTabelaPrecoPage() {
  const session = await requirePainelAccess("vis_tabpre", "/painel/tabela-preco/adicionar");

  return (
    <PainelTabelaPrecoFormPage
      legacyResources={session.legacyResources}
      mode="create"
    />
  );
}
