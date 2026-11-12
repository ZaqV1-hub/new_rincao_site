import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PainelCashSessionPage } from "@/components/painel-cash-session-page";
import { PainelBilheteriaSalesBuilder } from "@/components/painel-bilheteria-sales-builder";
import { getCashSession, CashSessionError } from "@/lib/operational-cash-session";
import { getSaoPauloToday } from "@/lib/operational-date";
import { getBilheteriaAgendaStatusToday } from "@/lib/bilheteria-agenda";
import { loadOperationalDayOffer } from "@/lib/operational-day-offer";
import { requirePainelAccess } from "@/lib/painel-session";
import { lookupPainelBilheteriaTicketByVoucherId, PainelBilheteriaWorkstationError } from "@/lib/painel-bilheteria-workstation";

export const metadata = { title: "Caixa | Painel Rincão", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function CashSessionPage({ params, searchParams }: { params: Promise<{ periodId: string }>; searchParams: Promise<{ tab?: string; ingresso?: string }> }) {
  const access = await requirePainelAccess("vis_bilhet", "/painel/caixas");
  if (access.authSource !== "panel") redirect("/painel/login?redirect=%2Fpainel%2Fcaixas");
  const raw = (await params).periodId;
  if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw))) notFound();
  let session;
  try { session = await getCashSession(Number(raw)); }
  catch (error) {
    if (error instanceof CashSessionError && error.status === 404) notFound();
    return <section className="space-y-3"><h1 className="text-2xl font-bold">Caixa indisponível</h1><p role="alert">Não foi possível consultar esta sessão.</p><Link className="underline" href="/painel/caixas">Voltar aos caixas</Link></section>;
  }
  const today = getSaoPauloToday(), writable = session.closedAt === null && session.date === today;
  let saleData: { agendas: Awaited<ReturnType<typeof getBilheteriaAgendaStatusToday>>["openAgendas"]; products: Awaited<ReturnType<typeof loadOperationalDayOffer>>["products"] } | null = null;
  let saleError = false;
  if (writable && session.type === "sales") {
    try {
      const { openAgendas } = await getBilheteriaAgendaStatusToday();
      const agenda = openAgendas[0];
      const offer = agenda ? await loadOperationalDayOffer(agenda, undefined, "gate") : { products: [] };
      saleData = { agendas: openAgendas, products: offer.products };
    } catch { saleError = true; }
  }
  const sale = saleError ? <p role="alert">Não foi possível consultar a oferta desta data. Consulte novamente antes de vender.</p> : saleData ? <PainelBilheteriaSalesBuilder periodId={session.id} today={today} agendas={saleData.agendas} products={saleData.products} /> : <p>O caixa não está disponível para novas vendas.</p>;
  const query = await searchParams;
  let lookup;
  if (typeof query.ingresso === "string" && session.type === "sales") {
    const value = query.ingresso.trim();
    try { lookup = { isOpen: true, lookup: value, result: await lookupPainelBilheteriaTicketByVoucherId(value), error: null }; }
    catch (error) { lookup = { isOpen: true, lookup: value, result: null, error: error instanceof PainelBilheteriaWorkstationError ? error.message : "Não foi possível consultar este ingresso agora." }; }
  }
  return <PainelCashSessionPage key={`${session.id}:${session.snapshot.generatedAt}`} initial={session} today={today} initialTab={query.tab} initialTicketLookupState={lookup} sale={sale} operator={{ name: access.actorName ?? null, cpf: access.actorCpf ?? null, isManager: access.legacyRoleId === 1 }} />;
}
