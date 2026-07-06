import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PainelClienteDetailPage } from "@/components/painel-cliente-detail-page";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Detalhe do Cliente | Rincao",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelClientesDetalhePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePainelAccess(["vis_clientes", "vis_escola"], "/painel/clientes/detalhe");
  const params = (await searchParams) ?? {};
  const idValue = Array.isArray(params.id) ? params.id[0] : params.id;
  const clientId = Number(idValue);

  if (!Number.isInteger(clientId) || clientId <= 0) {
    redirect("/painel/clientes");
  }

  return <PainelClienteDetailPage clientId={clientId} />;
}
