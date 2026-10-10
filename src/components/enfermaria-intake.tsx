"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./enfermaria-visual.module.css";

type Client = { id: number; name: string; address: string; hasTripToday: boolean };
type Trip = { id: number; date: string; status: string };
type Purchase = { id: number; status: string; cpf: string; buyerName: string; visitDate: string; ticketCount: number; tickets: string };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Não foi possível concluir a ação.");
  return payload.data as T;
}

export function EnfermariaIntake({ professional }: { professional: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<"cliente" | "day_use">("cliente");
  const [query, setQuery] = useState("");
  const [cpf, setCpf] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripId, setTripId] = useState("");
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [registerNoAccount, setRegisterNoAccount] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualSource, setManualSource] = useState("");
  const [manualCpf, setManualCpf] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (registerNoAccount) return;
    const value = kind === "cliente" ? query.trim() : cpf.replace(/\D/g, "");
    const ready = kind === "cliente" ? value.length >= 2 : value.length === 11;
    if (!ready) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearched(false);
      setError("");
      try {
        if (kind === "cliente") {
          const found = await api<Client[]>(`/api/painel/enfermaria?action=clients&q=${encodeURIComponent(value)}`);
          if (active) setClients(found);
        } else {
          const found = await api<Purchase[]>(`/api/painel/enfermaria?action=day-use&cpf=${encodeURIComponent(value)}`);
          if (active) setPurchases(found);
        }
        if (active) setSearched(true);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Falha na busca.");
      } finally {
        if (active) setSearching(false);
      }
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [kind, query, cpf, registerNoAccount]);

  async function chooseClient(client: Client) {
    setSelectedClient(client); setTripId(""); setError("");
    try { setTrips(await api<Trip[]>(`/api/painel/enfermaria?action=trips&clientId=${client.id}`)); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível carregar passeios."); }
  }

  async function create(body: Record<string, unknown>) {
    setBusy(true); setError("");
    try {
      const result = await api<{ id: number }>("/api/painel/enfermaria", { method: "POST", body: JSON.stringify({ action: "create", occurredAt: new Date().toISOString(), ...body }) });
      router.push(`/painel/enfermaria/${result.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível abrir o atendimento."); }
    finally { setBusy(false); }
  }

  function startNoAccount() {
    setRegisterNoAccount(true);
    setManualName(kind === "cliente" ? query : `Day use ${cpf}`);
    setManualCpf(kind === "day_use" ? cpf : "");
    setManualSource(kind === "day_use" ? "Bilheteria presencial" : "");
    setManualPhone(""); setManualReason("");
  }

  const fieldClass = "w-full rounded-lg border border-[#d6e1ea] bg-white px-4 py-3 text-sm outline-none focus:border-[#2877a8]";
  const buttonClass = "rounded-lg bg-[#176b96] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className={`${styles.page} ${styles.workflowPage} grid w-full gap-6 pb-7`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm text-slate-500">Enfermaria / Novo atendimento</p><h1 className="mt-1 text-3xl font-semibold text-[#194d6b]">Novo atendimento</h1></div>
        <Link className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700" href="/painel/enfermaria">Voltar ao painel</Link>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {!registerNoAccount ? <>
          <h2 className="text-xl font-semibold text-slate-800">A quem fica vinculado?</h2>
          <p className="mt-2 text-sm text-slate-600">Procure o cadastro primeiro. Se não encontrar, você pode registrar sem cadastro.</p>
          <div className={styles.choices}>
            <button onClick={() => { setKind("cliente"); setSearched(false); setClients([]); setSelectedClient(null); setSearching(false); }} className={`${styles.choice} ${kind === "cliente" ? styles.choiceActive : ""}`} aria-pressed={kind === "cliente"}>
              <span className={styles.choiceTitle}>Cliente</span><span className={styles.choiceDescription}>Escola, grupo ou empresa com cadastro no painel.</span>
            </button>
            <button onClick={() => { setKind("day_use"); setSearched(false); setPurchases([]); setSelectedPurchase(null); setSearching(false); }} className={`${styles.choice} ${kind === "day_use" ? styles.choiceActive : ""}`} aria-pressed={kind === "day_use"}>
              <span className={styles.choiceTitle}>Day use</span><span className={styles.choiceDescription}>Localize a compra pelo CPF de quem comprou os ingressos.</span>
            </button>
          </div>
          {kind === "cliente" ? <>
            <label className="mt-5 block text-sm font-medium text-slate-700" htmlFor="client-search">Buscar cliente</label>
            <input id="client-search" className={`${fieldClass} mt-2`} value={query} onChange={(event) => { setQuery(event.target.value); setSearched(false); setSearching(false); setClients([]); setSelectedClient(null); setTrips([]); setTripId(""); }} placeholder="Digite o nome da escola, grupo ou empresa" autoComplete="off" role="combobox" aria-expanded={clients.length > 0 && !selectedClient} aria-controls="client-suggestions" />
            {searching && <p className="mt-2 text-sm text-slate-500">Buscando clientes...</p>}
            {searched && !searching && clients.length === 0 && <div className="mt-3 rounded-lg border border-dashed border-slate-300 p-6 text-center"><p className="font-semibold text-[#183e63]">Nenhum cliente encontrado</p><p className="mt-2 text-sm text-slate-600">Grupos mistos e outros visitantes sem cadastro não aparecem aqui.<br />Nesse caso, registre o atendimento sem cadastro.</p><button onClick={startNoAccount} className="mt-4 rounded-lg bg-[#183e63] px-5 py-3 text-sm font-semibold text-white">Registrar sem cadastro</button></div>}
            {clients.length > 0 && !selectedClient && <div id="client-suggestions" role="listbox" className="mt-2 max-h-80 overflow-y-auto rounded-lg border border-slate-200 shadow-sm">{clients.map((client) => <button key={client.id} role="option" aria-selected={false} onClick={() => void chooseClient(client)} className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-sky-50"><span className="block font-medium text-slate-800">{client.name}</span><span className="mt-1 block text-xs text-slate-500">{client.address || "Endereço não informado"} · {client.hasTripToday ? "Passeio hoje" : "Sem passeio hoje"}</span></button>)}</div>}
            {selectedClient && <div className="mt-5 rounded-xl bg-sky-50 p-4"><label className="block text-sm font-semibold text-slate-800" htmlFor="trip-select">Passeio deste atendimento</label><select id="trip-select" className={`${fieldClass} mt-2`} value={tripId} onChange={(event) => setTripId(event.target.value)}><option value="">Selecione o passeio</option>{trips.map((trip) => <option key={trip.id} value={trip.id}>{new Date(`${trip.date}T12:00:00`).toLocaleDateString("pt-BR")} · {trip.status === "ati" ? "Aberto" : trip.status}</option>)}</select><button className={`${buttonClass} mt-3`} disabled={!tripId || busy} onClick={() => void create({ source: "cliente", clientId: selectedClient.id, clientName: selectedClient.name, tripId: Number(tripId) })}>Abrir ficha</button></div>}
          </> : <>
            <label className="mt-5 block text-sm font-medium text-slate-700" htmlFor="buyer-cpf">CPF de quem comprou os ingressos</label>
            <input id="buyer-cpf" className={`${fieldClass} mt-2`} value={cpf} onChange={(event) => { setCpf(event.target.value); setSearched(false); setSearching(false); setPurchases([]); setSelectedPurchase(null); }} placeholder="000.000.000-00" inputMode="numeric" />
            <p className="mt-2 text-xs text-slate-500">A pessoa atendida pode ser outra; ela será identificada na ficha.</p>
            {searching && <p className="mt-2 text-sm text-slate-500">Buscando compras...</p>}
            {searched && !searching && purchases.length === 0 && <div className="mt-3 rounded-lg border border-dashed border-slate-300 p-6 text-center"><p className="font-semibold text-[#183e63]">Nenhuma compra encontrada para este CPF</p><p className="mt-2 text-sm text-slate-600">Visitantes da bilheteria presencial também podem ser atendidos sem cadastro.</p><button onClick={startNoAccount} className="mt-4 rounded-lg bg-[#183e63] px-5 py-3 text-sm font-semibold text-white">Registrar sem cadastro</button></div>}
            {purchases.length > 0 && <div className="mt-3 grid gap-2">{purchases.map((purchase) => <button key={purchase.id} onClick={() => setSelectedPurchase(purchase)} className={`rounded-xl border p-4 text-left ${selectedPurchase?.id === purchase.id ? "border-sky-500 bg-sky-50" : "border-slate-200 hover:bg-slate-50"}`}><span className="block font-semibold text-slate-800">{purchase.buyerName} · Compra #{purchase.id}</span><span className="mt-1 block text-sm text-slate-600">Visita {new Date(`${purchase.visitDate}T12:00:00`).toLocaleDateString("pt-BR")} · {purchase.ticketCount} ingresso(s)</span><span className="mt-1 block text-xs text-slate-500">{purchase.tickets} · {purchase.status}</span></button>)}</div>}
            {selectedPurchase && <button className={`${buttonClass} mt-4`} disabled={busy} onClick={() => void create({ source: "day_use", purchaseId: selectedPurchase.id, buyerCpf: selectedPurchase.cpf, buyerName: selectedPurchase.buyerName, visitDate: selectedPurchase.visitDate, ticketCount: selectedPurchase.ticketCount, ticketSummary: selectedPurchase.tickets })}>Abrir ficha vinculada à compra #{selectedPurchase.id}</button>}
          </>}
        </> : <>
          <h2 className="text-xl font-semibold text-slate-800">Atendimento sem cadastro</h2>
          <p className="mt-2 text-sm text-slate-600">O atendimento terá número, ficha completa, histórico e encerramento. Nos relatórios, aparecerá como Sem cadastro.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2 text-sm font-medium text-slate-700">Quem é a pessoa ou o grupo <span className="text-red-600">*</span><input className={`${fieldClass} mt-2`} value={manualName} onChange={(event) => setManualName(event.target.value)} required /></label>
            <label className="text-sm font-medium text-slate-700">Como entrou no parque<select className={`${fieldClass} mt-2`} value={manualSource} onChange={(event) => setManualSource(event.target.value)}><option value="">Selecione (opcional)</option>{["Grupo misto", "Igreja", "Excursão", "Empresa", "Bilheteria presencial", "Cortesia", "Convidado ou fornecedor", "Outro"].map((v) => <option key={v}>{v}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">CPF do responsável<input className={`${fieldClass} mt-2`} value={manualCpf} onChange={(event) => setManualCpf(event.target.value)} /></label>
            <label className="text-sm font-medium text-slate-700">Telefone de contato<input className={`${fieldClass} mt-2`} value={manualPhone} onChange={(event) => setManualPhone(event.target.value)} /></label>
            <label className="text-sm font-medium text-slate-700">Por que não há cadastro<input className={`${fieldClass} mt-2`} value={manualReason} onChange={(event) => setManualReason(event.target.value)} /></label>
          </div>
          <div className="mt-5 flex gap-3"><button className="rounded-lg border border-slate-300 px-4 py-3 text-sm" onClick={() => setRegisterNoAccount(false)}>Voltar à busca</button><button className={buttonClass} disabled={!manualName.trim() || busy} onClick={() => void create({ source: "sem_cadastro", initialName: manualName, intakeSource: manualSource, guardianCpf: manualCpf, guardianPhone: manualPhone, noAccountReason: manualReason })}>Abrir ficha</button></div>
        </>}
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      </section>
      <p className="text-xs text-slate-500">Profissional autenticado: {professional || "Usuário do painel"}</p>
    </div>
  );
}
