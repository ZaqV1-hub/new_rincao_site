import type { Metadata } from "next";
import { PainelInformacaoFormPage } from "@/components/painel-informacao-form-page";
import { getPainelInformacao } from "@/lib/painel-informacoes";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Editar Informacao | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelEditarInformacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePainelAccess("vis_info", "/painel/informacao");
  const { id } = await params;
  const information = await getPainelInformacao(id);

  return (
    <PainelInformacaoFormPage
      information={information}
      legacyResources={session.legacyResources}
      mode="edit"
    />
  );
}
