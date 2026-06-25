import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BilheteriaCashClosureEditsPage } from "@/components/bilheteria-cash-closure-edits-page";
import { listBilheteriaCashEdits } from "@/lib/bilheteria-cash-data";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Log de Edicoes do Caixa | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelBilheteriaFechamentoCaixaEdicoesPage({
  searchParams,
}: {
  searchParams: Promise<{
    fechamento_id?: string;
    page?: string;
  }>;
}) {
  const session = await requirePainelAccess(
    ["vis_bilhet", "vis_compra"],
    "/painel/bilheteria/fechamento-caixa/edicoes",
  );

  if (session.legacyRoleId !== 1) {
    redirect("/painel/bilheteria/fechamento-caixa");
  }

  const params = await searchParams;
  const closureId = Number(params.fechamento_id ?? 0);
  const page = Number(params.page ?? 1);
  const edits = await listBilheteriaCashEdits({
    closureId: Number.isInteger(closureId) && closureId > 0 ? closureId : null,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: 50,
  });

  return (
    <BilheteriaCashClosureEditsPage
      actorName={session.actorName}
      edits={edits}
    />
  );
}
