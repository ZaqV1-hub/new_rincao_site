"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { EnfermariaLocal } from "@/lib/enfermaria";
import styles from "./enfermaria-visual.module.css";

type PlaceDialog =
  | { kind: "create"; name: string }
  | { kind: "rename"; place: EnfermariaLocal; name: string };

export function EnfermariaPlaces({ canManage }: { canManage: boolean }) {
  const [places, setPlaces] = useState<EnfermariaLocal[]>([]);
  const [name, setName] = useState("");
  const [dialog, setDialog] = useState<PlaceDialog | null>(null);
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const response = await fetch("/api/painel/enfermaria?action=locals");
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error?.message ?? "Falha ao carregar os locais.");
    setPlaces(result.data);
  }

  useEffect(() => {
    void fetch("/api/painel/enfermaria?action=locals")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error?.message ?? "Falha ao carregar os locais.");
        setPlaces(result.data);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Falha ao carregar os locais."));
  }, []);

  useEffect(() => {
    if (!dialog) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) setDialog(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dialog, busy]);

  async function save(payload: { id?: number; name: string; active?: boolean }) {
    setBusy(true);
    setError("");
    setDialogError("");
    try {
      const response = await fetch("/api/painel/enfermaria", {
        method: payload.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "local", ...payload }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error?.message ?? "Não foi possível salvar o local.");
      await reload();
      if (dialog) {
        setDialog(null);
        if (dialog.kind === "create") setName("");
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível salvar o local.";
      if (dialog) setDialogError(message);
      else setError(message);
    } finally {
      setBusy(false);
    }
  }

  function openCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Informe o nome do local antes de continuar.");
      return;
    }
    setError("");
    setDialogError("");
    setDialog({ kind: "create", name: trimmed });
  }

  function openRename(place: EnfermariaLocal) {
    setError("");
    setDialogError("");
    setDialog({ kind: "rename", place, name: place.name });
  }

  function submitDialog() {
    if (!dialog) return;
    const trimmed = dialog.name.trim();
    if (!trimmed) {
      setDialogError("Informe o nome do local.");
      return;
    }
    if (dialog.kind === "rename" && trimmed === dialog.place.name) {
      setDialog(null);
      return;
    }
    void save(dialog.kind === "create"
      ? { name: trimmed }
      : { id: dialog.place.id, name: trimmed, active: dialog.place.active });
  }

  return <div className={`${styles.page} ${styles.workflowPage} grid gap-5 pb-7`}>
    <header>
      <p className="text-sm text-slate-500"><Link href="/painel/enfermaria">Enfermaria</Link> / Locais</p>
      <h1 className="mt-1 text-3xl font-semibold text-[#194d6b]">Locais do parque</h1>
      <p className="mt-1 text-sm text-slate-600">Os locais cadastrados aqui aparecem na ficha, no histórico e nos gráficos.</p>
    </header>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-800">Adicionar local</h2>
      {canManage ? <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); openCreate(); }}>
        <input className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do local" aria-label="Nome do local" />
        <button type="submit" className="rounded-lg bg-[#176b96] px-4 py-2 text-sm font-semibold text-white">Adicionar local</button>
      </form> : <p className="mt-2 text-sm text-slate-600">O cadastro e a alteração de locais estão disponíveis para gerente.</p>}
      <p className="mt-3 text-xs text-slate-500">Um local desativado some da ficha, mas permanece nos atendimentos antigos e relatórios.</p>
    </section>

    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Local</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Ações</th></tr></thead>
        <tbody>{places.map((place) => <tr className="border-t border-slate-100" key={place.id}>
          <td className="px-4 py-3">{place.name}</td>
          <td className="px-4 py-3">{place.active ? "Ativo" : "Desativado"}</td>
          <td className="px-4 py-3">
            {canManage && <button type="button" className="text-[#176b96] underline" onClick={() => openRename(place)}>Renomear</button>}
            {canManage && <button type="button" className={`ml-4 underline ${place.active ? "text-red-700" : "text-[#176b96]"}`} disabled={busy} onClick={() => void save({ id: place.id, name: place.name, active: !place.active })}>{place.active ? "Desativar" : "Reativar"}</button>}
          </td>
        </tr>)}{places.length === 0 && <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={3}>Nenhum local cadastrado.</td></tr>}</tbody>
      </table>
    </section>
    <Link href="/painel/enfermaria" className="text-sm font-semibold text-[#176b96]">← Voltar ao painel</Link>

    {dialog && <div className={styles.modalBackdrop} role="presentation">
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="enfermaria-local-modal-title">
        <form onSubmit={(event) => { event.preventDefault(); submitDialog(); }}>
          <h2 id="enfermaria-local-modal-title" className={styles.modalTitle}>{dialog.kind === "create" ? "Confirmar novo local" : "Renomear local"}</h2>
          {dialog.kind === "create" ? <p className="mt-3 text-sm text-slate-600">Criar o local <strong className="text-[#0f2d52]">{dialog.name}</strong>? Ele ficará disponível nas próximas fichas de atendimento.</p> : <>
            <p className="mt-3 text-sm text-slate-600">O novo nome também aparecerá nos atendimentos antigos ligados a este local.</p>
            <label className="mt-4 block text-sm font-medium text-slate-700">Nome do local
              <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" autoFocus maxLength={120} value={dialog.name} onChange={(event) => setDialog({ ...dialog, name: event.target.value })} />
            </label>
          </>}
          {dialogError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{dialogError}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm" disabled={busy} onClick={() => setDialog(null)}>Cancelar</button>
            <button type="submit" className="rounded-lg bg-[#176b96] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy}>{busy ? "Salvando..." : dialog.kind === "create" ? "Criar local" : "Salvar nome"}</button>
          </div>
        </form>
      </div>
    </div>}
  </div>;
}
