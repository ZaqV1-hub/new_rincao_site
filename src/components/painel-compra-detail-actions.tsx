"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { CashSession } from "@/lib/operational-cash-session";
import type { OperationalVoucherWhatsappResult } from "@/lib/operational-voucher-whatsapp";
import { getSaoPauloToday } from "@/lib/operational-date";
import { prepareStoredCashCommand, readStoredCashCommand } from "@/lib/cash-command-client";

type Props = {
  purchaseId: number;
  voucherIds: number[];
  canOperate: boolean;
  onBusyChange: (busy: boolean) => void;
  onOperationComplete: () => void;
};
const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-lg border border-[#b8cedd] px-4 py-2 font-semibold disabled:opacity-50";

export function selectedVoucherPrintHref(purchaseId: number, voucherIds: number[]) {
  return `/painel/bilheteria/compras/${purchaseId}/imprimir?${new URLSearchParams({ voucherIds: voucherIds.join(",") })}`;
}

export function PainelCompraDetailActions({ purchaseId, voucherIds, canOperate, onBusyChange, onOperationComplete }: Props) {
  const router = useRouter();
  const [refreshing, refresh] = useTransition();
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [cashState, setCashState] = useState<"loading" | "ready" | "error">("loading");
  const [cashAttempt, setCashAttempt] = useState(0);
  const [periodId, setPeriodId] = useState("");
  const [confirmAction, setConfirmAction] = useState<"validate" | "unvalidate" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [destinationConfirmed, setDestinationConfirmed] = useState(false);
  const [pendingWhatsapp, setPendingWhatsapp] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [whatsappResult, setWhatsappResult] = useState<OperationalVoucherWhatsappResult | null>(null);
  const storageKey = `rincao:purchase:${purchaseId}:whatsapp`;
  const locked = busy || refreshing || pendingWhatsapp;
  useEffect(() => { onBusyChange(locked); }, [locked, onBusyChange]);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      try {
        const pending = readStoredCashCommand(storageKey);
        if (!active) return;
        setPendingWhatsapp(Boolean(pending)); setStorageReady(true);
      } catch { if (active) setError("Não foi possível recuperar a solicitação salva. Peça conferência ao responsável antes de enviar outra."); }
    });
    return () => { active = false; };
  }, [storageKey]);
  useEffect(() => {
    if (!canOperate) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/painel/caixas?date=${getSaoPauloToday()}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok || result?.ok !== true || !Array.isArray(result.data)) throw new Error();
        const available = result.data.filter((session: CashSession) => !session.closedAt && session.type === "sales" && session.date === getSaoPauloToday());
        setSessions(available);
        setPeriodId((current) => available.some((session: CashSession) => String(session.id) === current) ? current : "");
        setCashState("ready");
      } catch { if (!controller.signal.aborted) setCashState("error"); }
    })();
    return () => controller.abort();
  }, [canOperate, cashAttempt]);

  function updateDetail() {
    onOperationComplete();
    refresh(() => router.refresh());
  }
  async function operate() {
    if (!confirmAction || !periodId || voucherIds.length === 0 || locked) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const response = await fetch(`/api/painel/compras/${purchaseId}/vouchers/${confirmAction}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ voucherIds, periodId: Number(periodId) }),
      });
      const result = await response.json();
      if (!response.ok || result?.ok !== true) {
        setError(result?.error?.message ?? "Não foi possível confirmar a operação. Confira o estado dos vouchers antes de tentar novamente.");
      } else {
        setMessage([result.data.message, ...(result.data.warnings ?? [])].filter(Boolean).join(" "));
      }
    } catch { setError("A resposta não chegou. Confira o estado atualizado dos vouchers antes de tentar novamente."); }
    finally { setBusy(false); setConfirmAction(null); updateDetail(); }
  }
  async function sendWhatsapp(recover = false) {
    if (busy || refreshing || !storageReady || !recover && (pendingWhatsapp || !destinationConfirmed || !phone.trim() || !voucherIds.length)) return;
    setBusy(true); setError(null); setMessage(null);
    let requestPrepared = false;
    try {
      const command = recover ? readStoredCashCommand(storageKey) : prepareStoredCashCommand(storageKey, { voucherIds, phoneNumber: phone, destinationConfirmed: true });
      if (!command) throw new Error();
      requestPrepared = true;
      setPendingWhatsapp(true);
      const response = await fetch(`/api/painel/compras/${purchaseId}/whatsapp`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...command.payload, idempotencyKey: command.idempotencyKey }) });
      const result = await response.json();
      if (!response.ok || result?.ok !== true) {
        if (response.status === 400 && result?.error?.code === "whatsapp_invalid_input") {
          sessionStorage.removeItem(storageKey); setPendingWhatsapp(false); setDestinationConfirmed(false);
          setError(result.error.message); return;
        }
        // A failed HTTP response does not prove that an earlier request was not dispatched.
        setError(result?.error?.message ?? "Solicitação sem confirmação. Confira novamente usando o mesmo pedido.");
        return;
      }
      const delivery = result.data as OperationalVoucherWhatsappResult;
      setWhatsappResult(delivery);
      if (["accepted", "queued", "failed"].includes(delivery.status)) {
        sessionStorage.removeItem(storageKey); setPendingWhatsapp(false); setPhone(""); setDestinationConfirmed(false); updateDetail();
      }
    } catch {
      if (requestPrepared) { setError("Solicitação sem confirmação. Use Conferir solicitação para consultar o mesmo pedido sem duplicar o envio."); setPendingWhatsapp(true); }
      else { setStorageReady(false); setError("Não foi possível salvar ou recuperar a solicitação neste navegador. Nenhum novo envio foi iniciado; peça conferência antes de continuar."); }
    }
    finally { setBusy(false); }
  }

  return <section className="space-y-4 rounded-lg border border-[#d4dde5] bg-white p-5 text-sm text-[#123b63]" aria-labelledby="purchase-actions-title">
    <h2 id="purchase-actions-title" className="text-lg font-semibold">Ações dos vouchers</h2>
    <p aria-live="polite">{voucherIds.length} voucher(s) selecionado(s)</p>
    {voucherIds.length > 0 ? <a className={buttonClass} href={selectedVoucherPrintHref(purchaseId, voucherIds)} target="_blank" rel="noreferrer">Imprimir selecionados</a> : <p>Selecione os vouchers na tabela para imprimir ou operar.</p>}
    <a className={buttonClass} href={`/api/painel/compras/${purchaseId}/resumo`} target="_blank" rel="noreferrer">Gerar resumo da compra</a>
    {canOperate && <>
      <div className="space-y-3 border-t border-[#d4dde5] pt-4">
        <label className="grid gap-2">Caixa de hoje para registrar a operação<select className="min-h-11 rounded-lg border p-2" value={periodId} disabled={locked || cashState !== "ready"} onChange={(event) => { setPeriodId(event.target.value); setConfirmAction(null); }}><option value="">Selecione o caixa</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.locationName} · #{session.id}</option>)}</select></label>
        {cashState === "loading" && <p>Buscando caixas abertos…</p>}
        {cashState === "error" && <p role="alert">Caixas indisponíveis. <button className="underline" type="button" onClick={() => { setCashState("loading"); setCashAttempt((value) => value + 1); }}>Tentar novamente</button></p>}
        {cashState === "ready" && sessions.length === 0 && <p>Nenhum caixa aberto hoje. <a className="underline" href={`/painel/agenda/${getSaoPauloToday()}?tab=caixas`}>Abrir caixas da data</a></p>}
        <div className="flex flex-wrap gap-2"><button className={buttonClass} disabled={locked || !periodId || !voucherIds.length} type="button" onClick={() => setConfirmAction("validate")}>Validar selecionados</button><button className={buttonClass} disabled={locked || !periodId || !voucherIds.length} type="button" onClick={() => setConfirmAction("unvalidate")}>Desvalidar selecionados</button></div>
        {confirmAction && <div className="space-y-3 rounded-lg bg-[#eef4f8] p-3"><p>{confirmAction === "validate" ? "Confirmar entrada" : "Desfazer entrada"} de {voucherIds.length} voucher(s) no caixa #{periodId}?</p><button className={buttonClass} type="button" disabled={locked} onClick={() => void operate()}>Confirmar {confirmAction === "validate" ? "validação" : "desvalidação"}</button><button className={buttonClass} type="button" disabled={busy} onClick={() => setConfirmAction(null)}>Cancelar</button></div>}
      </div>
      <div className="space-y-3 border-t border-[#d4dde5] pt-4">
        <h3 className="font-semibold">WhatsApp dos selecionados</h3>
        {pendingWhatsapp ? <><p>Existe uma solicitação sem confirmação. Consulte o mesmo pedido antes de iniciar outro.</p><button className={buttonClass} disabled={busy || refreshing || !storageReady} type="button" onClick={() => void sendWhatsapp(true)}>Conferir solicitação</button></> : <>
          <label className="grid gap-2">Telefone com DDD<input type="tel" autoComplete="off" maxLength={24} value={phone} disabled={locked} className="min-h-11 rounded-lg border p-2" onChange={(event) => { setPhone(event.target.value); setDestinationConfirmed(false); }} /></label>
          <label className="flex items-start gap-2"><input type="checkbox" checked={destinationConfirmed} disabled={locked} onChange={(event) => setDestinationConfirmed(event.target.checked)} />Conferi o telefone e autorizo o envio destes vouchers para esse destinatário.</label>
          <button className={buttonClass} disabled={locked || !storageReady || !destinationConfirmed || !phone.trim() || !voucherIds.length} type="button" onClick={() => void sendWhatsapp()}>Solicitar envio por WhatsApp</button>
        </>}
        {whatsappResult && <p role="status">{whatsappResult.message} Destino: {whatsappResult.destinationMasked}. Solicitação {whatsappResult.requestId}.</p>}
      </div>
    </>}
    {refreshing && <p role="status">Atualizando os dados da compra…</p>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
