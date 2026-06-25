import type { Metadata } from "next";
import { PainelCategoriaFormPage } from "@/components/painel-categoria-form-page";
import { getPainelDiscountType } from "@/lib/painel-descontos";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Editar Categoria | Estancia",
  robots: { index: false, follow: false },
};

export default async function PainelEditarCategoriaPageRoute({
  params,
}: {
  params: Promise<{ typeId: string }>;
}) {
  await requirePainelAccess(["vis_desc"], "/painel/categorias");
  const { typeId } = await params;
  const type = await getPainelDiscountType(typeId);
  return (
    <PainelCategoriaFormPage
      initialValues={{ descricao: type.description }}
      mode="edit"
      typeId={type.id}
    />
  );
}
