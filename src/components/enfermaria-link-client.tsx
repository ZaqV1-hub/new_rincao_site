"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Client = { id: number; name: string; address: string; hasTripToday: boolean };
export function EnfermariaLinkClient({ recordId }: { recordId: number }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [selected, setSelected] = useState<Client | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  useEffect(() => {
    const value = query.trim();
    if (value.length < 2 || selected) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setSearching(true); setError("");
      try {
        const response = await fetch(`/api/painel/enfermaria?action=clients&q=${encodeURIComponent(value)}`);
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Falha na busca.");
        if (active) { setClients(payload.data); setSearched(true); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "Falha na busca."); }
      finally { if (active) setSearching(false); }
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, selected]);
  async function link() {
    if (!selected) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/painel/enfermaria/${recordId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "link-client", clientId: selected.id }) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Falha ao vincular.");
      router.push(`/painel/enfermaria/${recordId}`); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao vincular."); }
    finally { setBusy(false); }
  }
  return <section className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h1 className="text-2xl font-semibold text-[#194d6b]">Vincular a um cliente</h1><p className="mt-2 text-sm text-slate-600">Este atendimento foi registrado sem cadastro. O vínculo ficará registrado no histórico da ficha.</p><label className="mt-5 block text-sm font-medium text-slate-700" htmlFor="enf-link-client-search">Cliente</label><input id="enf-link-client-search" className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm" value={query} onChange={(e) => { setQuery(e.target.value); setSelected(null); setClients([]); setSearched(false); setError(""); }} placeholder="Digite o nome para escolher no menu" autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={clients.length > 0 && !selected} aria-controls="enf-link-client-options" />{searching && <p className="mt-2 text-sm text-slate-500">Buscando clientes...</p>}{clients.length > 0 && !selected && <div id="enf-link-client-options" role="listbox" className="mt-2 max-h-72 divide-y overflow-y-auto rounded-lg border border-slate-200 shadow-sm">{clients.map((client) => <button type="button" key={client.id} role="option" aria-selected={false} onClick={() => { setSelected(client); setQuery(client.name); setClients([]); }} className="block w-full px-4 py-3 text-left hover:bg-sky-50"><span className="block font-medium">{client.name}</span><span className="text-xs text-slate-500">{client.address || "Endereço não informado"}</span></button>)}</div>}{searched && !searching && clients.length === 0 && !selected && <p className="mt-2 text-sm text-slate-500">Nenhum cliente encontrado.</p>}{selected && <p className="mt-2 text-sm font-medium text-[#176b96]">Selecionado: {selected.name}</p>}{error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button className="rounded-lg border px-4 py-2 text-sm" onClick={() => history.back()}>Cancelar</button><button disabled={!selected || busy} className="rounded-lg bg-[#176b96] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void link()}>Vincular</button></div></section>;
}

export function EnfermariaClientRecords({ clientId }: { clientId: number }) {
  const [records, setRecords] = useState<Array<{ id: number; numberLabel: string; occurredAt: string; status: string; localName: string | null; form: Record<string, unknown> }>>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch(`/api/painel/enfermaria?action=records&clientId=${clientId}`).then(async (response) => {
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Não foi possível carregar atendimentos.");
      setRecords(payload.data); setLoaded(true);
    }).catch((e: unknown) => { setError(e instanceof Error ? e.message : "Falha ao carregar atendimentos."); setLoaded(true); });
  }, [clientId]);
  return <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-xl font-semibold text-[#194d6b]">Atendimentos de enfermaria</h2><p className="mt-1 text-xs text-slate-500">Visível apenas para Gerente e Enfermeiro(a).</p>{error ? <p className="mt-3 text-sm text-red-700">{error}</p> : !loaded ? <p className="mt-3 text-sm text-slate-500">Carregando atendimentos…</p> : records.length ? <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="text-xs text-slate-500"><th className="py-2">Nº</th><th className="py-2">Data</th><th className="py-2">Atendido</th><th className="py-2">Local</th><th className="py-2">Status</th></tr></thead><tbody>{records.map((record) => <tr className="border-t" key={record.id}><td className="py-2"><a className="text-[#176b96] underline" href={`/painel/enfermaria/${record.id}`}>{record.numberLabel}</a></td><td className="py-2">{new Date(record.occurredAt.replace(" ", "T")).toLocaleDateString("pt-BR")}</td><td className="py-2">{String((record.form.identification as Record<string, unknown> | undefined)?.name ?? "—")}</td><td className="py-2">{record.localName ?? "—"}</td><td className="py-2">{record.status === "aberto" ? "Em aberto" : "Encerrado"}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-slate-500">Nenhum atendimento de enfermaria vinculado.</p>}</section>;
}
