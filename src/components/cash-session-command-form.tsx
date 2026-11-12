"use client";

import { useEffect, useState } from "react";
import { CurrencyInput, parseCurrencyInput } from "@/components/currency-input";
import { readStoredCashCommand, submitCashCommand } from "@/lib/cash-command-client";
import type { CashLocation } from "@/lib/operational-day-contract";

type Props = { disabled?: boolean; onSuccess: (data: unknown) => void } & (
  | { action: "open"; date: string; locations: CashLocation[] }
  | { action: "movement" | "close"; periodId: number }
);
const field = "min-h-11 w-full rounded-lg border border-[#c8d9ea] bg-white px-3 py-2 text-[#123b63] disabled:opacity-60";
const button = "inline-flex min-h-11 items-center justify-center rounded-lg bg-[#205a7f] px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";

export function CashSessionCommandForm(props: Props) {
  const storageKey = `cash-${props.action}:${props.action === "open" ? props.date : props.periodId}`;
  const url = props.action === "open" ? "/api/painel/caixas" : `/api/painel/caixas/${props.periodId}/${props.action === "close" ? "fechar" : "movimentos"}`;
  const [ready, setReady] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null);
  const pending = pendingPayload !== null;
  const [formVersion, setFormVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      try { setPendingPayload(readStoredCashCommand(storageKey)?.payload ?? null); setReady(true); }
      catch { setError("Não foi possível recuperar a tentativa anterior neste navegador. Confira o caixa antes de continuar."); }
    });
    return () => { active = false; };
  }, [storageKey]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !ready || (props.disabled && !pending)) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const amountCents = Math.round(parseCurrencyInput(String(data.get("amount") ?? "")) * 100);
    const payload = props.action === "open"
      ? { date: props.date, locationId: Number(data.get("locationId")), openingCashCents: amountCents }
      : props.action === "movement"
        ? { type: String(data.get("type")), responsible: String(data.get("responsible") ?? ""), amountCents, reason: String(data.get("reason") ?? "") }
        : { countedCashCents: amountCents, reason: String(data.get("reason") ?? "") };
    setBusy(true); setError(null);
    try {
      const result = await submitCashCommand({ storageKey, url, ...(pending ? {} : { payload }) });
      if (result.ok) { setPendingPayload(null); form.reset(); setFormVersion((value) => value + 1); props.onSuccess(result.data); }
      else {
        if (result.uncertain) {
          try { setPendingPayload(readStoredCashCommand(storageKey)?.payload ?? null); }
          catch { setReady(false); }
        } else setPendingPayload(null);
        setError(result.message);
      }
    } finally { setBusy(false); }
  }
  const unavailable = (props.disabled && !pending) || busy || !ready;
  const pendingCents = pendingPayload?.openingCashCents ?? pendingPayload?.amountCents ?? pendingPayload?.countedCashCents;
  if (props.action === "open" && props.disabled && !pending) return error ? <p role="alert">{error}</p> : null;
  return <form onSubmit={submit} className="space-y-4">
    {pending && <dl className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
      <dt className="font-semibold">Operação enviada</dt><dd>{props.action === "open" ? "Abertura de caixa" : props.action === "close" ? "Fechamento de caixa" : pendingPayload.type === "sangria" ? "Retirar sangria" : "Adicionar fundo"}</dd>
      {props.action === "open" ? <><dt className="mt-2 font-semibold">Data e local</dt><dd>{String(pendingPayload.date)} · {props.locations.find((location) => location.id === pendingPayload.locationId)?.name ?? `Local #${String(pendingPayload.locationId)}`}</dd></> : <><dt className="mt-2 font-semibold">Caixa</dt><dd>#{props.periodId}</dd></>}
    </dl>}
    {pending && <div role="status" className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><p>Há uma tentativa sem confirmação neste navegador. Confira o resultado usando os mesmos dados antes de iniciar outra operação.</p>{typeof pendingCents === "number" && <p>Valor enviado: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(pendingCents / 100)}</p>}{typeof pendingPayload.responsible === "string" && <p>Pessoa: {pendingPayload.responsible}</p>}{typeof pendingPayload.reason === "string" && <p>Motivo: {pendingPayload.reason}</p>}</div>}
    <fieldset disabled={unavailable || pending} hidden={pending} className={pending ? "hidden" : "grid gap-4 sm:grid-cols-2"}>
      {props.action === "open" && <label className="grid gap-1 text-sm font-semibold">Local<select name="locationId" className={field} required defaultValue=""><option value="" disabled>Selecione o local</option>{props.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>}
      {props.action === "movement" && <><label className="grid gap-1 text-sm font-semibold">Movimento<select name="type" className={field}><option value="fundo">Adicionar fundo</option><option value="sangria">Retirar sangria</option></select></label><label className="grid gap-1 text-sm font-semibold">Nome da pessoa<input className={field} name="responsible" maxLength={100} required /></label></>}
      <label className="grid gap-1 text-sm font-semibold">{props.action === "open" ? "Troco inicial" : props.action === "close" ? "Dinheiro contado" : "Valor"}<CurrencyInput key={`${storageKey}:${formVersion}`} name="amount" className={field} required defaultValue="0,00" /></label>
      {props.action !== "open" && <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Motivo<textarea className={field} name="reason" maxLength={2000} required rows={2} /></label>}
    </fieldset>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
    <button type="submit" className={button} disabled={unavailable || (props.action === "open" && props.locations.length === 0 && !pending)}>{busy ? "Conferindo operação…" : pending ? "Conferir tentativa anterior" : props.action === "open" ? "Abrir caixa" : props.action === "close" ? "Conferir e fechar caixa" : "Registrar movimento"}</button>
  </form>;
}
