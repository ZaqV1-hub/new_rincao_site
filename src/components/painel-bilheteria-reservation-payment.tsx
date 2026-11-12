"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import type { PainelBilheteriaPurchaseDetail } from "@/lib/painel-bilheteria";
import { readStoredCashCommand, submitCashCommand } from "@/lib/cash-command-client";
import { cashInputCents, previewCashPayments, reservationCommandStorageKey } from "@/lib/painel-bilheteria-sales";
import { CashPaymentFields, cashDisplay, type CashPaymentRow } from "./painel-bilheteria-sale-finalize";

function initialPayment(periodId: number | undefined, purchaseId: number) {
  if (!periodId || typeof window === "undefined") return { command: null, issue: null };
  try { return { command: readStoredCashCommand(reservationCommandStorageKey(periodId, purchaseId)), issue: null }; }
  catch { return { command: null, issue: "Não foi possível ler a operação salva. Peça conferência ao responsável antes de continuar." }; }
}
const subscribeReady = () => () => {};
export function PainelBilheteriaReservationPayment({ detail, periodId, readOnly = false }: {
  detail: PainelBilheteriaPurchaseDetail; periodId?: number; readOnly?: boolean;
}) {
  const clientReady = useSyncExternalStore(subscribeReady, () => true, () => false);
  const [initial] = useState(() => initialPayment(periodId, detail.purchaseId));
  const [pending, setPending] = useState(Boolean(initial.command || initial.issue));
  const totalCents = cashInputCents(detail.totalValue) ?? 0;
  const [rows, setRows] = useState<CashPaymentRow[]>(() => Array.isArray(initial.command?.payload.payments) ? initial.command.payload.payments as CashPaymentRow[] : totalCents === 0 ? [] : [{ method: "", value: detail.totalValue }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initial.issue ?? (initial.command ? "Há uma tentativa anterior sem confirmação. Confira novamente antes de registrar outro pagamento." : null));
  const [success, setSuccess] = useState<{ message: string; changeCents: number } | null>(null);
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [deliveryMessage, setDeliveryMessage] = useState<string | null>(null);
  const alreadyPaid = !detail.payableReservation && !pending;
  const back = periodId ? `/painel/caixas/${periodId}?tab=reservas` : "/painel/caixas";
  async function confirm() {
    if (!periodId || submitting || initial.issue) return;
    let payload: Record<string, unknown> | undefined;
    if (!pending) {
      if (readOnly || alreadyPaid) return;
      const preview = previewCashPayments(totalCents, rows);
      if (!preview.ok) { setError(preview.message); return; }
      payload = { periodId, payments: preview.payments };
    }
    setSubmitting(true); setError(null);
    const result = await submitCashCommand<{ message: string; changeCents: number }>({ storageKey: reservationCommandStorageKey(periodId, detail.purchaseId), url: `/api/painel/bilheteria/reservations/${detail.purchaseId}/pay`, ...(payload ? { payload } : {}) });
    setSubmitting(false);
    if (!result.ok) { setPending(result.uncertain); setError(result.message); return; }
    setSuccess(result.data); setPending(false);
  }
  async function sendWhatsapp() {
    if (sending) return;
    setSending(true); setDeliveryMessage(null);
    try {
      const response = await fetch(`/api/painel/bilheteria/purchases/${detail.purchaseId}/whatsapp`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phoneNumber: phone, voucherIds: detail.vouchers.map((voucher) => voucher.voucherId) }) });
      const result = await response.json();
      setDeliveryMessage(response.ok && result.ok ? result.data?.message ?? "Ingressos enviados." : result.error?.message ?? "Não foi possível enviar os ingressos.");
    } catch { setDeliveryMessage("Não foi possível confirmar o envio. Confira antes de enviar novamente."); } finally { setSending(false); }
  }
  if (!clientReady) return <p>Carregando recebimento…</p>;
  return <section className="panel-section grid gap-4 p-5">
    <h2 className="text-xl font-bold">Pagamento da reserva #{detail.purchaseId}</h2>
    <p>CPF cadastrado: {detail.cpf ?? "Não informado"}</p>
    <p>Total: {cashDisplay(totalCents)}</p>
    {!periodId ? <><p>Escolha um caixa de vendas aberto para receber esta reserva.</p><Link href="/painel/caixas">Escolher caixa</Link></> : success || alreadyPaid ? <>
      <p role="status">{success?.message ?? "Reserva sem pagamento pendente."}</p>{success ? <p>Troco confirmado: {cashDisplay(success.changeCents)}</p> : null}
      <a href={`/painel/bilheteria/compras/${detail.purchaseId}/imprimir`} target="_blank" rel="noreferrer">Imprimir QR-Codes</a>
      <label>Telefone com DDD<input className="m-2 rounded border p-2" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
      <button disabled={sending} onClick={() => void sendWhatsapp()} className="justify-self-start rounded border p-2">Enviar WhatsApp</button>{deliveryMessage ? <p role="status">{deliveryMessage}</p> : null}
    </> : <><CashPaymentFields rows={rows} onChange={setRows} totalCents={totalCents} disabled={readOnly || pending || submitting} />
      {readOnly ? <p>Caixa encerrado ou fora da data de hoje. A tentativa anterior ainda pode ser conferida.</p> : null}
      {error ? <p role="alert" className="text-red-800">{error}</p> : null}
      <button className="justify-self-start rounded bg-green-800 px-4 py-3 text-white disabled:opacity-50" disabled={submitting || Boolean(initial.issue) || (readOnly && !pending)} onClick={() => void confirm()}>{submitting ? "Conferindo..." : pending ? "Conferir tentativa anterior" : "Confirmar pagamento"}</button>
    </>}
    <Link href={back}>Voltar ao caixa</Link>
  </section>;
}
