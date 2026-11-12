import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { asOperationalCashError } from "@/lib/ops-cash-management";
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
  if (session.authSource !== "panel") redirect("/painel/login");
  let warningMessage: string | null = null;
  let summary;

  try {
    summary = await getBilheteriaCashFundSummary();
    const { hasOpenAgendaToday } = await getBilheteriaAgendaStatusToday();
    warningMessage = hasOpenAgendaToday
      ? null
      : "Não existe agenda aberta para hoje. A reconciliação do caixa legado continua disponível.";
  } catch (error) {
    const needsSession = asOperationalCashError(error).code === "cash_session_required";
    return (
      <section role="status" className="rounded-[24px] border border-[#d7e5ef] bg-white p-6 text-[#205a7f]">
        <h1 className="text-2xl font-semibold">Fundo de caixa</h1>
        <p className="mt-3">{needsSession
          ? "Não há caixa legado aberto. Selecione um caixa por local e data para continuar."
          : "Não foi possível carregar o resumo do caixa agora. Tente novamente mais tarde."}</p>
        <Link href="/painel/caixas" className="mt-4 inline-block font-semibold underline">Selecionar caixa</Link>
      </section>
    );
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
