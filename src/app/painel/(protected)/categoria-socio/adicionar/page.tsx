import type { Metadata } from "next";
import { PainelCategoriaSocioFormPage } from "@/components/painel-categoria-socio-form-page";
import { getPainelCategoriaSocioFormContext } from "@/lib/painel-categoria-socio";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Adicionar Categoria Socio | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PainelAdicionarCategoriaSocioPage() {
  const session = await requirePainelAccess("vis_catsoc", "/painel/categoria-socio/adicionar");
  const context = await getPainelCategoriaSocioFormContext();

  return (
    <PainelCategoriaSocioFormPage
      legacyResources={session.legacyResources}
      mode="create"
      priceTableOptions={context.priceTableOptions}
    />
  );
}
