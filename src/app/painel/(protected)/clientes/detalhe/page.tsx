import type { Metadata } from "next";
import { PainelClienteDetailPage } from "@/components/painel-cliente-detail-page";
import { getPainelClientDetail } from "@/lib/painel-clientes";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Detalhe do Cliente | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelClientesDetalhePage({
  searchParams,
}: {
  searchParams: Promise<{
    id?: string;
  }>;
}) {
  await requirePainelAccess(["vis_clientes", "vis_escola"], "/painel/clientes/detalhe");
  const params = await searchParams;
  const data = await getPainelClientDetail(params.id ?? "");

  return <PainelClienteDetailPage data={data} />;
}
