import type { Metadata } from "next";
import { PainelCategoriaFormPage } from "@/components/painel-categoria-form-page";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Nova Categoria | Estancia",
  robots: { index: false, follow: false },
};

export default async function PainelNovaCategoriaPageRoute() {
  await requirePainelAccess(["vis_desc"], "/painel/categorias");
  return (
    <PainelCategoriaFormPage initialValues={{ descricao: "" }} mode="create" />
  );
}
