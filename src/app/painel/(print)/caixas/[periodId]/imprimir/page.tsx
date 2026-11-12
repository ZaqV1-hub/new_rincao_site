import { notFound, redirect } from "next/navigation";
import { CashSessionSnapshotView } from "@/components/cash-session-snapshot-view";
import { EnfermariaPrintButton } from "@/components/enfermaria-print-button";
import { CashSessionError, getCashSession } from "@/lib/operational-cash-session";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata = { title: "Relatório do caixa | Rincão", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function CashSessionPrintPage({ params }: { params: Promise<{ periodId: string }> }) {
  const access = await requirePainelAccess("vis_bilhet", "/painel/caixas");
  if (access.authSource !== "panel") redirect("/painel/login?redirect=%2Fpainel%2Fcaixas");
  const id = (await params).periodId;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) notFound();
  let session;
  try { session = await getCashSession(Number(id)); }
  catch (error) { if (error instanceof CashSessionError && error.status === 404) notFound(); return <p role="alert">Não foi possível consultar o relatório deste caixa.</p>; }
  return <main className="mx-auto max-w-5xl space-y-6 bg-white p-6 text-left text-[#123b63] print:max-w-none print:p-0"><style>{"@page { size: A4; margin: 12mm; }"}</style><div className="print:hidden"><EnfermariaPrintButton /></div><header className="space-y-2"><h1 className="text-2xl font-bold">Relatório do caixa · {session.locationName}</h1><p>{session.date.split("-").reverse().join("/")} · Sessão #{session.id} · {session.park === "rincao" ? "Rincão" : "Estância"}</p><p>{session.closedAt ? "Fechamento registrado" : "Consulta de caixa aberto · valores sujeitos a novas operações"}</p><p>Aberto por {session.openedBy.name ?? "operador identificado"}{session.closedBy && ` · Fechado por ${session.closedBy.name ?? "operador identificado"}`}</p></header><CashSessionSnapshotView snapshot={session.snapshot} /></main>;
}
