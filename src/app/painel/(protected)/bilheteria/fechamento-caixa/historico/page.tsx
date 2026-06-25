import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BilheteriaCashClosureHistoryPage } from "@/components/bilheteria-cash-closure-history-page";
import { listBilheteriaCashClosureHistory } from "@/lib/bilheteria-cash-data";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Historico de Fechamentos | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelBilheteriaFechamentoCaixaHistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
  }>;
}) {
  const session = await requirePainelAccess(
    ["vis_bilhet", "vis_compra"],
    "/painel/bilheteria/fechamento-caixa/historico",
  );

  if (session.legacyRoleId !== 1) {
    redirect("/painel/bilheteria/fechamento-caixa");
  }

  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const history = await listBilheteriaCashClosureHistory({
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: 30,
  });

  return (
    <BilheteriaCashClosureHistoryPage
      actorName={session.actorName}
      history={history}
    />
  );
}
