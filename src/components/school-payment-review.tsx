"use client";

import { useCallback, useEffect, useState } from "react";

type Hold = { status: string; review_reference: string | null; review_revision: number; payment_id: string; attempt_count: number };
type Event = { id: string; status: string; review_reference: string | null; created_at: string;
  operation?: { action: string; reason: string; actor: { name: string | null } } | null };
const labels: Record<string, string> = {
  queued: "Aguardando admissão", review_required: "Aguardando revisão", review_unavailable: "Revisão indisponível",
  duplicate_confirmed: "Duplicidade confirmada", review_expired: "Revisão expirada", context_required: "Contexto incompleto",
  expired_visit: "Data da visita vencida", payment_unconfirmed: "Pagamento não confirmado", released: "Ingresso liberado",
};

async function readReview(endpoint: string) {
  const response = await fetch(endpoint, { cache: "no-store" });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error?.message || "Consulta indisponível.");
  return result.data;
}

export function SchoolPaymentReview({ purchaseId }: { purchaseId: number }) {
  const [data, setData] = useState<{ hold: Hold | null; events: Event[]; canOperate: boolean } | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const endpoint = `/api/painel/compras/${purchaseId}/school-review`;
  const refresh = useCallback(async () => {
    try {
      setData(await readReview(endpoint)); setError("");
    } catch (error) { setError(error instanceof Error ? error.message : "Consulta indisponível."); }
  }, [endpoint]);
  useEffect(() => {
    let active = true;
    void readReview(endpoint).then(result => { if (active) { setData(result); setError(""); } })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : "Consulta indisponível."); });
    return () => { active = false; };
  }, [endpoint]);

  async function act(action: "reopen_review" | "follow_up") {
    if (!data?.hold || busy) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason, expected_revision: data.hold.review_revision, expected_status: data.hold.status }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error?.message || "Operação indisponível.");
      setReason(""); setNotice(action === "reopen_review" ? "Nova avaliação solicitada. O ingresso permanece retido até a decisão canônica." : "Acompanhamento registrado. A retenção permanece ativa.");
      await refresh();
    } catch (error) { await refresh(); setError(error instanceof Error ? error.message : "Operação indisponível."); }
    finally { setBusy(false); }
  }
  if (!data?.hold && !error) return null;
  const hold = data?.hold;
  return <section className="rounded-[6px] border border-[#d4dde5] bg-white p-5" aria-label="Revisão de pagamento escolar">
    <h2 className="text-lg font-semibold text-[#205a7f]">Pagamento escolar</h2>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm">{notice}</p>}
    {hold && <>
      <p className="mt-3 font-semibold">{labels[hold.status] || hold.status}</p>
      {hold.status !== "released" && <p className="mt-2 text-sm">Pagamento contabilizado. O ingresso permanece retido para envio e uso. Nenhum estorno automático é realizado.</p>}
      {hold.review_reference && <p className="mt-3 break-all text-xs">Revisão: {hold.review_reference}</p>}
      <button type="button" className="mt-3 text-sm text-[#1d68a2] underline" onClick={() => void refresh()} disabled={busy}>Atualizar estado</button>
      {data?.canOperate && hold.status !== "released" && <div className="mt-4 grid gap-3">
        <label className="text-sm">Justificativa do atendimento
          <textarea className="mt-1 w-full rounded border border-[#d4dde5] p-2" maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} disabled={busy} />
        </label>
        <button type="button" className="rounded border p-2 text-sm" disabled={busy || !reason.trim()} onClick={() => void act("follow_up")}>Registrar acompanhamento</button>
        {["duplicate_confirmed", "review_expired"].includes(hold.status) && <button type="button" className="rounded border p-2 text-sm" disabled={busy || !reason.trim()} onClick={() => void act("reopen_review")}>Solicitar nova avaliação</button>}
      </div>}
      <details className="mt-4 text-sm"><summary>Histórico da retenção</summary>
        <ol className="mt-2 grid gap-3">{data?.events.map(event => <li key={event.id}>
          <p>{labels[event.status] || event.status} · {new Date(event.created_at).toLocaleString("pt-BR")}</p>
          {event.operation && <p>{event.operation.actor.name || "Operador"}: {event.operation.reason}</p>}
        </li>)}</ol>
      </details>
    </>}
  </section>;
}
