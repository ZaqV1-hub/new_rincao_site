import type { Metadata } from "next";
import { BilheteriaCashClosurePage } from "@/components/bilheteria-cash-closure-page";
import { getBilheteriaCashClosureReport } from "@/lib/bilheteria-cash-data";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Fechamento de Caixa | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelBilheteriaFechamentoCaixaPage({
  searchParams,
}: {
  searchParams: Promise<{
    fechamento_id?: string;
  }>;
}) {
  const session = await requirePainelAccess("vis_bilhet", "/painel/bilheteria/fechamento-caixa");
  const params = await searchParams;
  const closureId = Number(params.fechamento_id ?? 0);
  const data = await getBilheteriaCashClosureReport(
    Number.isInteger(closureId) && closureId > 0 ? closureId : null,
  );

  return (
    <BilheteriaCashClosurePage
      actorCpf={session.actorCpf}
      actorName={session.actorName}
      closureId={data.closureId}
      isHistorical={data.isHistorical}
      isManager={session.legacyRoleId === 1}
      printHref={data.printHref}
      report={data.report}
    />
  );
}
