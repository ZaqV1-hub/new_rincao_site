import type { Metadata } from "next";
import { BilheteriaCashFundPage } from "@/components/bilheteria-cash-fund-page";
import { getBilheteriaAgendaStatusToday } from "@/lib/bilheteria-agenda";
import { getBilheteriaCashFundSummary } from "@/lib/bilheteria-cash-data";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Fundo de Caixa | Rincao",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelBilheteriaFundoCaixaPage() {
  const session = await requirePainelAccess("vis_bilhet", "/painel/bilheteria/fundo-caixa");
  const { hasOpenAgendaToday } = await getBilheteriaAgendaStatusToday();
  let warningMessage: string | null = hasOpenAgendaToday
    ? null
    : "Nao existe agenda aberta para hoje. O fundo de caixa continua visivel, mas venda e validacao ficam indisponiveis.";
  let summary;

  try {
    summary = await getBilheteriaCashFundSummary();
  } catch {
    warningMessage =
      "Nao foi possivel carregar o resumo do caixa agora. A tela continua acessivel para evitar erro de navegacao.";
    summary = {
      period: {
        id: 0,
        openedAt: null,
        closedAt: null,
        operator: null,
        closureSheetId: null,
      },
      funds: [],
      sangrias: [],
      totals: {
        cashSales: "0.00",
        fund: "0.00",
        sangria: "0.00",
        cashInDrawer: "0.00",
      },
    };
  }

  return (
    <BilheteriaCashFundPage
      actorCpf={session.actorCpf}
      actorName={session.actorName}
      isManager={session.legacyRoleId === 1}
      summary={summary}
      warningMessage={warningMessage}
    />
  );
}
