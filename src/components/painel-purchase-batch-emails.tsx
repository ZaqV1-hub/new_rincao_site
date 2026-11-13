"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PurchaseBatchEmailHistory, PurchaseBatchEmailSummary } from "@/lib/operational-purchase-batch-email";

const endpoint = "/api/painel/compras/lote/email";
export function PainelPurchaseBatchEmails({ automaticBatchId }: { automaticBatchId?: string }) {
  const [history,setHistory] = useState<PurchaseBatchEmailHistory>([]);
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  const load = useCallback(async (batchId?: string) => {
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setBusy(true); setMessage("");
    const read = async (response: Response) => {
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error?.message || "Não foi possível conferir os avisos.");
      return body.data;
    };
    try {
      if (batchId) {
        // At most 100 purchases; each request claims up to five notices before SMTP.
        for (let page = 0; page < 20; page++) {
          const summary: PurchaseBatchEmailSummary = await read(await fetch(endpoint,{ method: "POST",headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ batchId }),signal: controller.signal }));
          if (controller.signal.aborted) return;
          setMessage(`${summary.accepted} aviso(s) aceito(s) pelo servidor de e-mail; ${summary.pending} pendente(s).`);
          if (!summary.configured || !summary.pending) break;
        }
      }
      const rows: PurchaseBatchEmailHistory = await read(await fetch(endpoint,{ cache: "no-store",signal: controller.signal }));
      if (!controller.signal.aborted) setHistory(rows);
    } catch (error) {
      if (!controller.signal.aborted) setMessage(`${error instanceof Error ? error.message : "Consulta indisponível."} A alteração das compras permanece registrada. Confira os avisos novamente; envios incertos não serão repetidos.`);
    } finally { if (!controller.signal.aborted) setBusy(false); }
  },[]);
  useEffect(() => {
    const timer = setTimeout(() => void load(automaticBatchId),0);
    return () => { clearTimeout(timer); active.current?.abort(); };
  },[automaticBatchId,load]);
  return <details className="space-y-3 border-t border-[#b8cbdc] pt-3" open={!!automaticBatchId || !!message}>
    <summary className="min-h-11 cursor-pointer text-sm font-semibold">Avisos de alterações recentes deste operador</summary>
    <p className="text-sm">Até 20 lotes recentes, com envios pendentes primeiro. Aceite pelo servidor de e-mail não confirma entrega na caixa de entrada.</p>
    <button type="button" disabled={busy} className="min-h-11 rounded-lg border border-[#b8cbdc] px-3 text-sm disabled:opacity-50" onClick={() => void load()}>Atualizar avisos</button>
    {busy && <p role="status" className="text-sm">Conferindo e-mails…</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
    <ul className="space-y-3">{history.map(row => <li key={row.batchId} className="rounded-lg border border-[#d4dfeb] bg-white p-3 text-sm">
      <p className="font-semibold">Compras {row.purchaseIds.map(id => `#${id}`).join(", ")}</p>
      <p>{row.summary.accepted} aceito(s); {row.summary.pending} pendente(s); {row.summary.dispatching} em envio; {row.summary.failed} falhou; {row.summary.unknown} sem resultado confirmado.</p>
      {!row.summary.configured && row.summary.pending > 0 && <p>O envio de e-mail não está configurado neste ambiente. Os avisos permanecem pendentes.</p>}
      {row.summary.unknown > 0 && <p>Resultado incerto: conferir com o responsável antes de qualquer novo envio.</p>}
      {(row.summary.pending > 0 || row.summary.dispatching > 0) && <button type="button" disabled={busy} className="min-h-11 underline disabled:opacity-50" onClick={() => void load(row.batchId)}>Conferir e processar avisos pendentes</button>}
    </li>)}</ul>
  </details>;
}
