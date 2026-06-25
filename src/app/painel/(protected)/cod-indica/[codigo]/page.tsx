import type { Metadata } from "next";
import { PainelCodIndicaDetailPage } from "@/components/painel-cod-indica-detail-page";
import { getPainelCodIndicaDetail } from "@/lib/painel-cod-indica";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Detalhe Cod Indica | Estancia",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PainelCodIndicaDetailPageRoute({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePainelAccess(["vis_indica"], "/painel/cod-indica");
  const { codigo } = await params;
  const filters = await searchParams;
  const detail = await getPainelCodIndicaDetail(codigo, filters);

  return (
    <PainelCodIndicaDetailPage
      actorCpf={session.actorCpf}
      actorName={session.actorName}
      detail={detail}
      isManager={session.legacyRoleId === 1}
    />
  );
}
