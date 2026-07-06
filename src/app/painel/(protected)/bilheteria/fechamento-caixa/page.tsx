import type { Metadata } from "next";
import { BilheteriaCashClosurePage } from "@/components/bilheteria-cash-closure-page";
import { getBilheteriaCashClosureReport } from "@/lib/bilheteria-cash-data";
import { buildBilheteriaCashClosureReportModel } from "@/lib/bilheteria-cash-view-model";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Fechamento de Caixa | Rincao",
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
  let data;

  try {
    data = await getBilheteriaCashClosureReport(
      Number.isInteger(closureId) && closureId > 0 ? closureId : null,
    );
  } catch {
    data = {
      closureId: null,
      isHistorical: false,
      printHref: null,
      report: buildBilheteriaCashClosureReportModel({
        period: {
          openedAt: null,
          closedAt: null,
        },
        siteRows: [],
        boxOfficeRows: [],
        discountGroups: [],
        courtesyRows: [],
        funds: [],
        sangrias: [],
        forms: {},
        formsDesc: {},
        totalFund: 0,
        totalSangria: 0,
        cashInDrawer: 0,
      }),
    };
  }

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
