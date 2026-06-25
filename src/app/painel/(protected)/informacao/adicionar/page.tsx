import type { Metadata } from "next";
import { PainelInformacaoFormPage } from "@/components/painel-informacao-form-page";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Adicionar Informacao | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PainelAdicionarInformacaoPage() {
  const session = await requirePainelAccess("vis_info", "/painel/informacao/adicionar");

  return (
    <PainelInformacaoFormPage
      legacyResources={session.legacyResources}
      mode="create"
    />
  );
}
