import type { Metadata } from "next";
import { PainelCodIndicaReportPage } from "@/components/painel-cod-indica-report-page";
import {
  asPainelCodIndicaError,
  loadPainelCodIndicaReport,
} from "@/lib/painel-cod-indica";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Relatorio Cod Indica | Estancia",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PainelCodIndicaReportPageRoute({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePainelAccess(["vis_indica"], "/painel/cod-indica");
  const { codigo } = await params;
  const query = await searchParams;
  const dtini = Array.isArray(query.dtini) ? query.dtini[0] ?? "" : (query.dtini ?? "");
  const dtfim = Array.isArray(query.dtfim) ? query.dtfim[0] ?? "" : (query.dtfim ?? "");

  let report = null;
  let error: string | null = null;

  if (dtini && dtfim) {
    try {
      report = await loadPainelCodIndicaReport(codigo, { dtini, dtfim });
    } catch (caught) {
      error = asPainelCodIndicaError(caught).message;
    }
  }

  return (
    <PainelCodIndicaReportPage
      codigo={codigo}
      dtfim={dtfim}
      dtini={dtini}
      error={error}
      report={report}
    />
  );
}
