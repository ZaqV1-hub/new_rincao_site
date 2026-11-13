"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readStoredCashCommand, submitCashCommand } from "@/lib/cash-command-client";
import type { PurchaseBatchInput, PurchaseBatchPreview, PurchaseBatchResult } from "@/lib/operational-purchase-batch-contract";
import { PainelPurchaseBatchEmails } from "@/components/painel-purchase-batch-emails";

const storageKey = "painel:purchase-batch:pending";
const field = "min-h-11 w-full rounded-lg border border-[#b8cbdc] bg-white px-3 py-2 text-sm disabled:opacity-50";
const button = "min-h-11 rounded-lg border border-[#b8cbdc] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50";
const dateLabel = (date: string) => date.split("-").reverse().join("/");
export function PainelPurchaseBatch({ purchaseIds,onBusyChange,onComplete }: {
  purchaseIds: number[]; onBusyChange?: (busy: boolean) => void; onComplete?: () => void;
}) {
  const router = useRouter();
  const [targetDate,setDate] = useState("");
  const [validity,setValidity] = useState<PurchaseBatchInput["validity"]>("keep");
  const [reason,setReason] = useState("");
  const [notifyEmail,setNotify] = useState(false);
  const [preview,setPreview] = useState<{ input: PurchaseBatchInput; data: PurchaseBatchPreview } | null>(null);
  const [result,setResult] = useState<PurchaseBatchResult | null>(null);
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const [pending,setPending] = useState(false);
  const [ready,setReady] = useState(false);
  const locked = busy || pending || !ready;
  const currentPreview = preview && JSON.stringify(preview.input.purchaseIds) === JSON.stringify(purchaseIds) ? preview : null;
  useEffect(() => {
    const timer = setTimeout(() => {
      try { setPending(readStoredCashCommand(storageKey) !== null); setReady(true); }
      catch { setMessage("Não foi possível conferir a tentativa salva neste navegador. Peça conferência antes de iniciar outro lote."); }
    },0);
    return () => clearTimeout(timer);
  },[]);
  useEffect(() => { onBusyChange?.(locked); },[locked,onBusyChange]);
  function edit() { setPreview(null); setResult(null); setMessage(""); }
  async function loadPreview() {
    setBusy(true); setMessage(""); setResult(null); setPreview(null);
    const input: PurchaseBatchInput = { purchaseIds,targetDate: targetDate || null,validity,reason,notifyEmail };
    try {
      const response = await fetch("/api/painel/compras/lote/preview",{ method: "POST",headers: { "Content-Type": "application/json" },body: JSON.stringify(input) });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error?.message || "Não foi possível gerar a prévia.");
      setPreview({ input,data: body.data });
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível gerar a prévia."); }
    finally { setBusy(false); }
  }
  async function apply(recover = false) {
    if (!recover && !currentPreview) return;
    setBusy(true); setMessage("");
    const outcome = await submitCashCommand<PurchaseBatchResult>({ storageKey,url: "/api/painel/compras/lote/apply",
      ...(recover ? {} : { payload: { ...preview!.input,fingerprint: preview!.data.fingerprint } }) });
    if (outcome.ok) {
      setResult(outcome.data); setPending(false); setPreview(null); onComplete?.(); router.refresh();
    } else { setMessage(outcome.message); setPending(outcome.uncertain); if (!outcome.uncertain) setPreview(null); }
    setBusy(false);
  }
  return <section className="min-w-0 space-y-4 rounded-xl border border-[#b8cbdc] bg-[#f4f8fc] p-4 text-[#123b63]" aria-label="Alterar data ou validade das compras">
    <h3 className="text-lg font-bold">Mover compras ou editar validade</h3>
    <p className="text-sm">{purchaseIds.length} compra(s) selecionada(s). A alteração inclui todos os ingressos e serviços da compra e mantém os preços pagos. Somente day use.</p>
    {pending && <div className="space-y-2"><p role="status">Há um lote sem confirmação neste navegador. Confira a mesma tentativa antes de alterar os dados.</p><button type="button" className={button} disabled={busy} onClick={() => void apply(true)}>Conferir tentativa pendente</button></div>}
    <form onSubmit={event => { event.preventDefault(); void loadPreview(); }} className="space-y-3">
      <fieldset disabled={locked} className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold">Nova data de visita<input type="date" aria-label="Nova data de visita" className={field} value={targetDate} onChange={event => { edit(); setDate(event.target.value); }} /><span className="font-normal">Deixe em branco para alterar somente a validade.</span></label>
        <label className="grid gap-1 text-sm font-semibold">Validade<select aria-label="Validade" className={field} value={validity} onChange={event => { edit(); setValidity(event.target.value as PurchaseBatchInput["validity"]); }}>
          <option value="keep">Manter data final atual</option><option value="day">Somente no dia da visita</option><option value="7_days">7 dias desde a visita</option><option value="30_days">30 dias desde a visita</option><option value="6_months">6 meses desde a visita</option>
        </select></label>
        <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Motivo<textarea required maxLength={1000} className={field} value={reason} onChange={event => { edit(); setReason(event.target.value); }} /></label>
        <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={notifyEmail} onChange={event => { edit(); setNotify(event.target.checked); }} />Avisar pelos e-mails cadastrados após a alteração</label>
        <button className={button} type="submit" disabled={!purchaseIds.length || (!targetDate && validity === "keep")}>Conferir prévia</button>
      </fieldset>
    </form>
    {busy && <p role="status">Conferindo dados…</p>}
    {message && <p role="alert">{message}</p>}
    {currentPreview && <div className="space-y-3"><h4 className="font-bold">Confira antes de confirmar</h4><ul className="space-y-3">
      {currentPreview.data.items.map(item => <li key={item.purchaseId} className="rounded-lg border border-[#d4dfeb] bg-white p-3 text-sm">
        <p className="font-semibold">Compra #{item.purchaseId} · {item.status === "eligible" ? "Pode alterar" : item.status === "adjustment_required" ? "Ajuste pendente" : "Não será alterada"}</p><p>{item.message}</p>
        {item.vouchers.map(v => <p key={v.id}>Voucher #{v.id}: {dateLabel(v.from)} a {dateLabel(v.until)} → {dateLabel(v.nextFrom)} a {dateLabel(v.nextUntil)}</p>)}
      </li>)}
    </ul><button type="button" className={button} disabled={locked || !currentPreview.data.items.some(i => i.status !== "rejected")} onClick={() => void apply()}>Confirmar alterações e pendências da prévia</button></div>}
    {result && <div role="status" className="space-y-2"><p>{result.applied.length} compra(s) alterada(s); {result.adjustments.length} ajuste(s) pendente(s); {result.rejected.length} compra(s) não alterada(s).</p>
      {result.adjustments.length > 0 && <p>Compras com histórico fechado mantêm os ingressos originais até a resolução do ajuste.</p>}
      {result.emailPending > 0 && <p>{result.emailPending} aviso(s) registrado(s) para envio. A entrega não está confirmada.</p>}
    </div>}
    <PainelPurchaseBatchEmails automaticBatchId={result?.emailPending ? result.batchId : undefined} />
  </section>;
}
