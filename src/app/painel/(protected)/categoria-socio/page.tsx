import type { Metadata } from "next";
import { PainelCategoriaSocioPage } from "@/components/painel-categoria-socio-page";
import { listPainelCategoriasSocio } from "@/lib/painel-categoria-socio";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Categoria Socio | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelCategoriaSocioPageRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePainelAccess("vis_catsoc", "/painel/categoria-socio");
  const query = await searchParams;
  const data = await listPainelCategoriasSocio(query);

  return (
    <PainelCategoriaSocioPage
      data={data}
      legacyResources={session.legacyResources}
    />
  );
}
