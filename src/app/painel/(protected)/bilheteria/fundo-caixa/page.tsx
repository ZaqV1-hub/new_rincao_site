import type { Metadata } from "next";
import { BilheteriaCashFundPage } from "@/components/bilheteria-cash-fund-page";
import { getBilheteriaCashFundSummary } from "@/lib/bilheteria-cash-data";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Fundo de Caixa | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelBilheteriaFundoCaixaPage() {
  const session = await requirePainelAccess("vis_bilhet", "/painel/bilheteria/fundo-caixa");
  const summary = await getBilheteriaCashFundSummary();

  return (
    <BilheteriaCashFundPage
      actorCpf={session.actorCpf}
      actorName={session.actorName}
      isManager={session.legacyRoleId === 1}
      summary={summary}
    />
  );
}
