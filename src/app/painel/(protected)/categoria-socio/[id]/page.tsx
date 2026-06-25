import type { Metadata } from "next";
import { PainelCategoriaSocioDetailPage } from "@/components/painel-categoria-socio-detail-page";
import { getPainelCategoriaSocio } from "@/lib/painel-categoria-socio";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Detalhe Categoria Socio | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelCategoriaSocioDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePainelAccess("vis_catsoc", "/painel/categoria-socio");
  const { id } = await params;
  const data = await getPainelCategoriaSocio(id);

  return (
    <PainelCategoriaSocioDetailPage
      data={data}
      legacyResources={session.legacyResources}
    />
  );
}
