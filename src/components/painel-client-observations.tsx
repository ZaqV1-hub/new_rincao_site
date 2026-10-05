"use client";

import { useState } from "react";

export type PainelClientObservation = {
  id: number;
  text: string;
  createdAt: string;
  createdBy: string | null;
};

type ObservationResponse = {
  ok?: boolean;
  data?: PainelClientObservation[];
  error?: { message?: string };
};

function formatObservationDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]} às ${match[4]}:${match[5]}` : value;
}

export function PainelClientObservations({
  apiUrl,
  initialObservations,
  canDelete,
  canAdd = true,
}: {
  apiUrl: string;
  initialObservations: PainelClientObservation[];
  canDelete: boolean;
  canAdd?: boolean;
}) {
  const [observations, setObservations] = useState(initialObservations);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const response = await fetch(apiUrl, { credentials: "same-origin" });
    const payload = (await response.json().catch(() => null)) as ObservationResponse | null;
    if (!response.ok || !payload?.ok || !payload.data) {
      throw new Error(payload?.error?.message || "Não foi possível atualizar as observações.");
    }
    setObservations(payload.data);
  }

  async function addObservation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const payload = (await response.json().catch(() => null)) as ObservationResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || "Não foi possível salvar a observação.");
      }
      setText("");
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar a observação.");
    } finally {
      setPending(false);
    }
  }

  async function removeObservation(id: number) {
    if (!window.confirm("Deseja excluir esta observação?")) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/${id}`, { method: "DELETE", credentials: "same-origin" });
      const payload = (await response.json().catch(() => null)) as ObservationResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || "Não foi possível excluir a observação.");
      }
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível excluir a observação.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-[6px] border border-[#d7e3ee] bg-white shadow-[0_10px_28px_rgba(26,61,94,0.08)]">
      <h2 className="border-b border-[#d7e3ee] bg-[#eef5fb] px-5 py-3 text-[20px] text-[#173f68]">Observações</h2>
      <div className="grid gap-4 p-5">
        {canAdd ? <form className="grid gap-3" onSubmit={addObservation}>
          <label className="grid gap-2 text-sm font-semibold text-[#35576f]">
            Adicionar observação
            <textarea
              className="min-h-24 w-full resize-y rounded-[6px] border border-[#b9d0e6] p-3 font-normal text-[#133d63]"
              maxLength={4000}
              onChange={(event) => setText(event.target.value)}
              required
              value={text}
            />
          </label>
          <button className="rounded-[6px] bg-[#246b99] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" disabled={pending || !text.trim()} type="submit">
            {pending ? "Aguarde..." : "Adicionar"}
          </button>
        </form> : null}
        {error ? <p className="text-sm text-[#9b3434]" role="alert">{error}</p> : null}
        <div className="grid gap-3" aria-label="Histórico de observações">
          {observations.length ? observations.map((observation) => (
            <article className="rounded-[6px] border border-[#d7e3ee] bg-[#f8fbfe] p-4" key={observation.id}>
              <p className="whitespace-pre-wrap break-words text-sm text-[#173f68]">{observation.text}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#65798c]">
                <span>{formatObservationDate(observation.createdAt)}{observation.createdBy ? ` · ${observation.createdBy}` : ""}</span>
                {canDelete ? (
                  <button className="font-semibold text-[#a43c3c] underline disabled:opacity-60" disabled={pending} onClick={() => void removeObservation(observation.id)} type="button">Excluir</button>
                ) : null}
              </div>
            </article>
          )) : <p className="text-sm text-[#65798c]">Nenhuma observação cadastrada.</p>}
        </div>
      </div>
    </section>
  );
}
