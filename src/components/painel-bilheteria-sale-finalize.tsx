"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { isValidCpf } from "@/lib/cpf";
import { readStoredCashCommand, submitCashCommand, type StoredCashCommand } from "@/lib/cash-command-client";
import { CASH_PAYMENT_OPTIONS, cashInputCents, previewCashPayments, saleCommandPayload, saleCommandStorageKey, saleDraftStorageKey, type PainelBilheteriaSaleDraft } from "@/lib/painel-bilheteria-sales";

export type CashPaymentRow = { method: string; value: string };
export function cashDisplay(cents: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100); }
export function CashPaymentFields({ rows, onChange, totalCents, disabled }: {
  rows: CashPaymentRow[]; onChange: (rows: CashPaymentRow[]) => void; totalCents: number; disabled: boolean;
}) {
  const preview = previewCashPayments(totalCents, rows);
  return <fieldset disabled={disabled} className="grid gap-3 disabled:opacity-70">
    <legend className="mb-3 font-semibold">Valores entregues por forma de pagamento</legend>
    {rows.map((row, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <label>Forma {index + 1}<select aria-label={`Forma ${index + 1}`} className="mt-1 w-full rounded border p-2" value={row.method} onChange={(event) => onChange(rows.map((item, i) => i === index ? { ...item, method: event.target.value } : item))}>
        <option value="">Selecione</option>{CASH_PAYMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select></label>
      <label>Valor entregue {index + 1}<input aria-label={`Valor entregue ${index + 1}`} inputMode="decimal" className="mt-1 w-full rounded border p-2" value={row.value} onChange={(event) => onChange(rows.map((item, i) => i === index ? { ...item, value: event.target.value } : item))} /></label>
      <button type="button" onClick={() => onChange(rows.filter((_, i) => i !== index))} className="rounded border px-3">Remover</button>
    </div>)}
    {totalCents === 0 && rows.length === 0 ? <p>Compra sem cobrança. Confirme para registrar os ingressos.</p> : null}
    <button type="button" disabled={rows.length >= 20} onClick={() => onChange([...rows, { method: "", value: "" }])} className="justify-self-start rounded border px-3 py-2">Adicionar forma</button>
    <p>Total da compra: <strong>{cashDisplay(totalCents)}</strong></p>
    {preview.ok ? <p aria-live="polite">Entregue: {cashDisplay(preview.receivedCents)} · Troco: <strong>{cashDisplay(preview.changeCents)}</strong></p> : <p>{preview.message}</p>}
  </fieldset>;
}

type SaleResult = { purchaseId: number; voucherIds: number[]; message: string; totalCents: number; receivedCents: number; changeCents: number };
function initialState(periodId: number) {
  if (typeof window === "undefined") return { draft: null, command: null, issue: null };
  let draft: PainelBilheteriaSaleDraft | null = null;
  let command: StoredCashCommand | null = null;
  try {
    const raw = sessionStorage.getItem(saleDraftStorageKey(periodId));
    draft = raw ? JSON.parse(raw) as PainelBilheteriaSaleDraft : null;
    if (draft && (draft.periodId !== periodId || !Array.isArray(draft.services) || !Array.isArray(draft.items) || !Array.isArray(draft.courtesies))) throw new Error("Invalid draft");
    command = readStoredCashCommand(saleCommandStorageKey(periodId));
    return { draft, command, issue: null };
  } catch { return { draft, command, issue: "Não foi possível ler a operação salva. Peça conferência ao responsável antes de continuar." }; }
}

const subscribeReady = () => () => {};
export function PainelBilheteriaSaleFinalize({ periodId, readOnly = false }: { periodId: number; readOnly?: boolean }) {
  const clientReady = useSyncExternalStore(subscribeReady, () => true, () => false);
  const [initial] = useState(() => initialState(periodId));
  const draft = initial.draft;
  const [pending, setPending] = useState(Boolean(initial.command || initial.issue));
  const [rows, setRows] = useState<CashPaymentRow[]>(() => Array.isArray(initial.command?.payload.payments)
    ? initial.command.payload.payments as CashPaymentRow[] : draft && cashInputCents(draft.totalValue) !== 0 ? [{ method: "", value: draft.totalValue }] : []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initial.issue ?? (initial.command ? "Há uma tentativa anterior sem confirmação. Confira os dados e tente conferir novamente." : null));
  const [success, setSuccess] = useState<SaleResult | null>(null);
  const [phone, setPhone] = useState("");
  const [deliveryMessage, setDeliveryMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const back = `/painel/caixas/${periodId}?tab=vendas`;
  const totalCents = cashInputCents(draft?.totalValue ?? "0") ?? 0;
  async function confirm() {
    if (submitting || initial.issue) return;
    let payload: Record<string, unknown> | undefined;
    if (!pending) {
      if (readOnly || !draft) return;
      if (!isValidCpf(draft.cpf)) { setError("Informe um CPF válido na compra antes de confirmar."); return; }
      const preview = previewCashPayments(totalCents, rows);
      if (!preview.ok) { setError(preview.message); return; }
      payload = saleCommandPayload(draft, preview.payments);
    }
    setSubmitting(true); setError(null);
    const result = await submitCashCommand<SaleResult>({ storageKey: saleCommandStorageKey(periodId), url: "/api/painel/bilheteria/sales", ...(payload ? { payload } : {}) });
    setSubmitting(false);
    if (!result.ok) { setPending(result.uncertain); setError(result.message); return; }
    setPending(false); setSuccess(result.data);
    try { sessionStorage.removeItem(saleDraftStorageKey(periodId)); } catch { /* Receipt remains visible even if browser storage becomes unavailable. */ }
  }
  async function sendWhatsapp() {
    if (!success || sending) return;
    setSending(true); setDeliveryMessage(null);
    try {
      const response = await fetch(`/api/painel/bilheteria/purchases/${success.purchaseId}/whatsapp`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phoneNumber: phone, voucherIds: success.voucherIds }) });
      const result = await response.json();
      setDeliveryMessage(response.ok && result.ok ? result.data?.message ?? "Ingressos enviados." : result.error?.message ?? "Não foi possível enviar os ingressos.");
    } catch { setDeliveryMessage("Não foi possível confirmar o envio. Confira antes de enviar novamente."); } finally { setSending(false); }
  }
  if (!clientReady) return <p>Carregando compra salva…</p>;
  if (!draft && !pending) return <section className="panel-section p-5"><p>Nenhuma compra preparada para este caixa.</p><Link href={back}>Voltar ao caixa</Link></section>;
  return <section className="grid gap-4 lg:grid-cols-2">
    <article className="panel-section p-5">
      <h2 className="text-xl font-bold">Conferir compra · caixa #{periodId}</h2>
      <p className="mt-3">CPF: {String(initial.command?.payload.cpf ?? draft?.cpf ?? "Indisponível")}</p>
      {draft ? <><p>Agenda: {draft.agendaLabel}</p><ul className="my-4 space-y-2">
        {draft.items.map((item, i) => <li key={`i${i}`}>{item.quantity} × {item.label} · {cashDisplay(cashInputCents(item.totalValue) ?? 0)}{item.discountLabel ? ` · ${item.discountLabel}` : ""}</li>)}
        {draft.services.map((item, i) => <li key={`s${i}`}>{item.quantity} × {item.label} · {cashDisplay(cashInputCents(item.totalValue) ?? 0)} · Sem desconto</li>)}
        {draft.courtesies.map((item, i) => <li key={`c${i}`}>{item.quantity} × Cortesia · {item.authorName}</li>)}
      </ul><p>Total: <strong>{cashDisplay(totalCents)}</strong></p></> : <p>Os dados da tentativa anterior permanecem salvos para conferência.</p>}
      <Link className="mt-4 inline-block underline" href={back}>Voltar ao caixa</Link>
    </article>
    <article className="panel-section p-5">
      {success ? <><h2 className="text-xl font-bold">Compra #{success.purchaseId} concluída</h2><p>{success.message}</p><p>Troco confirmado: <strong>{cashDisplay(success.changeCents)}</strong></p>
        <div className="my-4 flex gap-4"><a href={`/painel/bilheteria/compras/${success.purchaseId}/imprimir`} target="_blank" rel="noreferrer">Imprimir QRs</a><Link href={back}>Nova venda</Link></div>
        <label>Telefone com DDD<input className="m-2 rounded border p-2" value={phone} onChange={(event) => setPhone(event.target.value)} /></label><button disabled={sending} onClick={() => void sendWhatsapp()} className="rounded border p-2">Enviar WhatsApp</button>{deliveryMessage ? <p role="status">{deliveryMessage}</p> : null}
      </> : <><CashPaymentFields rows={rows} onChange={setRows} totalCents={totalCents} disabled={pending || submitting || readOnly} />
        {readOnly ? <p className="my-3">Este caixa está encerrado ou fora da data de hoje. Apenas a tentativa já enviada pode ser conferida.</p> : null}
        {error ? <p role="alert" className="my-3 text-red-800">{error}</p> : null}
        <button disabled={submitting || Boolean(initial.issue) || (readOnly && !pending)} onClick={() => void confirm()} className="mt-4 rounded bg-green-800 px-4 py-3 text-white disabled:opacity-50">{submitting ? "Conferindo..." : pending ? "Conferir tentativa anterior" : "Confirmar pagamento"}</button>
      </>}
    </article>
  </section>;
}
