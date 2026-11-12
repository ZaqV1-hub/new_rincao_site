"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode, type ComponentProps } from "react";
import { CashSessionCommandForm } from "@/components/cash-session-command-form";
import { CashSessionSnapshotView } from "@/components/cash-session-snapshot-view";
import { PainelBilheteriaWorkstation } from "@/components/painel-bilheteria-workstation";
import type { CashSessionDetail } from "@/lib/operational-cash-session";

const tabs = [{ id: "sale", label: "Vender" }, { id: "consultation", label: "Consultar ingresso" }, { id: "movement", label: "Fundo e sangria" }, { id: "closure", label: "Fechamento" }] as const;
type Tab = typeof tabs[number]["id"];
export function PainelCashSessionPage({ initial, today, sale, operator, initialTab, initialTicketLookupState }: { initial: CashSessionDetail; today: string; sale: ReactNode; operator: { name: string | null; cpf: string | null; isManager: boolean }; initialTab?: string; initialTicketLookupState?: ComponentProps<typeof PainelBilheteriaWorkstation>["initialTicketLookupState"] }) {
  const [session, setSession] = useState(initial);
  const [tab, setTab] = useState<Tab>(initialTicketLookupState || initialTab === "reservas" || initialTab === "consultation" ? "consultation" : initial.closedAt || initial.date !== today ? "closure" : initialTab === "movement" ? "movement" : initialTab === "closure" ? "closure" : "sale");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const requestSequence = useRef(0);
  const readOnly = session.closedAt !== null || session.date !== today;
  async function selectTab(next: Tab) {
    setTab(next); setRefreshing(true);
    const sequence = ++requestSequence.current;
    try {
      const response = await fetch(`/api/painel/caixas/${session.id}`, { cache: "no-store" });
      const body = await response.json();
      if (sequence !== requestSequence.current) return;
      if (!response.ok || !body.ok) throw new Error("Não foi possível atualizar os valores do caixa.");
      setSession(body.data);
      setError(null);
    } catch { if (sequence === requestSequence.current) setError("Não foi possível atualizar os valores do caixa. Tente consultar novamente antes de conferir o dinheiro."); }
    finally { if (sequence === requestSequence.current) setRefreshing(false); }
  }
  async function accept(data: unknown) {
    // Replays return their original response, which can predate a later closure.
    setSession((current) => current.closedAt ? current : data as CashSessionDetail);
    await selectTab(tab);
  }
  return <div className="space-y-6 text-[#123b63]">
    <header className="space-y-3"><Link className="inline-flex min-h-11 items-center underline" href={`/painel/caixas?date=${session.date}`}>Voltar aos caixas da data</Link><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">{session.locationName}</h1><span className="rounded-lg bg-[#edf4fa] px-3 py-2 font-semibold">{session.closedAt ? "Fechado" : "Aberto"} · #{session.id}</span></div><p>{session.date.split("-").reverse().join("/")} · {session.type === "trips" ? "Caixa de passeios" : "Caixa de vendas"}</p>{readOnly && <p>Esta sessão está disponível para consulta. Novos movimentos exigem um caixa aberto na data de hoje.</p>}</header>
    <div role="tablist" aria-label="Operações do caixa" className="flex gap-2 overflow-x-auto border-b border-[#d4dfeb] pb-2">{tabs.map((item, index) => <button ref={(node) => { buttons.current[index] = node; }} key={item.id} id={`cash-tab-${item.id}`} type="button" role="tab" aria-selected={tab === item.id} aria-controls={`cash-panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1} onClick={() => void selectTab(item.id)} onKeyDown={(event) => { const target = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null; if (target !== null) { event.preventDefault(); buttons.current[target]?.focus(); void selectTab(tabs[target].id); } }} className={`min-h-11 shrink-0 rounded-lg border px-4 py-2 font-semibold ${tab === item.id ? "border-[#205a7f] bg-[#205a7f] text-white" : "border-[#d4dfeb] bg-white"}`}>{item.label}</button>)}</div>
    {error && <div role="alert" className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4"><p>{error}</p><button type="button" className="min-h-11 underline" onClick={() => void selectTab(tab)}>Consultar valores novamente</button></div>}
    <section role="tabpanel" id={`cash-panel-${tab}`} aria-labelledby={`cash-tab-${tab}`} className="rounded-xl border border-[#d4dfeb] bg-white p-4 sm:p-6">
      {refreshing && <p role="status">Atualizando valores do caixa…</p>}
      {tab === "sale" && (error || refreshing ? <p>Consulte os valores do caixa antes de iniciar outra venda.</p> : readOnly ? <p>As vendas desta sessão foram encerradas.</p> : session.type === "trips" ? <p>Os recebimentos das escolas são registrados na página de cada passeio.</p> : sale)}
      {tab === "consultation" && (session.type === "trips" ? <p>A validação de ingressos utiliza um caixa de vendas.</p> : <PainelBilheteriaWorkstation cashSessionId={session.id} initialTicketLookupState={initialTicketLookupState} periodId={readOnly || error || refreshing ? null : session.id} actorName={operator.name} actorCpf={operator.cpf} isManager={operator.isManager} />)}
      {tab === "movement" && <div className="space-y-6"><h2 className="text-lg font-bold">Fundo e sangria</h2><CashSessionCommandForm action="movement" periodId={session.id} disabled={readOnly || error !== null || refreshing} onSuccess={(data) => accept((data as { session: CashSessionDetail }).session)} /><CashSessionSnapshotView snapshot={session.snapshot} /></div>}
      {tab === "closure" && <div className="space-y-6"><h2 className="text-lg font-bold">{session.closedAt ? "Fechamento registrado" : "Conferir e fechar caixa"}</h2><CashSessionSnapshotView snapshot={session.snapshot} /><Link className="inline-flex min-h-11 items-center underline" href={`/painel/caixas/${session.id}/imprimir`} target="_blank" rel="noopener noreferrer">Imprimir ou salvar relatório em PDF</Link><CashSessionCommandForm action="close" periodId={session.id} disabled={readOnly || error !== null || refreshing} onSuccess={accept} /></div>}
    </section>
  </div>;
}
