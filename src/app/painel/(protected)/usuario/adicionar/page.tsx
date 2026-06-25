import type { Metadata } from "next";
import { PainelUsuarioFormPage } from "@/components/painel-usuario-form-page";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Adicionar Usuario | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PainelAdicionarUsuarioPage() {
  const session = await requirePainelAccess("vis_usu", "/painel/usuario/adicionar");

  return (
    <PainelUsuarioFormPage
      legacyResources={session.legacyResources}
      mode="create"
    />
  );
}
