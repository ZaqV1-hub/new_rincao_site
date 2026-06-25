import type { Metadata } from "next";
import { PainelInformacoesPage } from "@/components/painel-informacoes-page";
import { listPainelInformacoes } from "@/lib/painel-informacoes";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Informacoes | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelInformacoesPageRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePainelAccess("vis_info", "/painel/informacao");
  const query = await searchParams;
  const data = await listPainelInformacoes(query);

  return (
    <PainelInformacoesPage
      data={data}
      legacyResources={session.legacyResources}
    />
  );
}
