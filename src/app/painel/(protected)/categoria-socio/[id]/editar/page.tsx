import type { Metadata } from "next";
import { PainelCategoriaSocioFormPage } from "@/components/painel-categoria-socio-form-page";
import {
  getPainelCategoriaSocio,
  getPainelCategoriaSocioFormContext,
} from "@/lib/painel-categoria-socio";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Editar Categoria Socio | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelEditarCategoriaSocioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePainelAccess("vis_catsoc", "/painel/categoria-socio");
  const { id } = await params;
  const category = await getPainelCategoriaSocio(id);
  const context = await getPainelCategoriaSocioFormContext(category.priceTableId);

  return (
    <PainelCategoriaSocioFormPage
      category={category}
      legacyResources={session.legacyResources}
      mode="edit"
      priceTableOptions={context.priceTableOptions}
    />
  );
}
