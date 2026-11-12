"use client";

import { useRef, useState, type FormEvent } from "react";
import { CurrencyInput } from "@/components/currency-input";
import type { CashLocation, OperationalService } from "@/lib/operational-day-contract";

type CatalogItem = OperationalService | CashLocation;
type Props = ({ kind: "services"; items: OperationalService[] } | { kind: "locations"; items: CashLocation[] }) & {
  canEdit: boolean;
};

function isService(item: CatalogItem): item is OperationalService {
  return "sitePriceCents" in item && "gatePriceCents" in item;
}

const fieldClass = "w-full rounded-lg border border-[#b8cbdc] bg-white px-3 py-2.5 text-[#123b63] outline-none focus:border-[#236699] focus:ring-2 focus:ring-[#236699]/20 disabled:bg-[#edf2f7]";
const buttonClass = "rounded-lg border border-[#b8cbdc] px-4 py-2.5 text-sm font-bold text-[#123b63] hover:bg-[#edf3f8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#236699] disabled:opacity-50";
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function PainelOperationalCatalog({ kind, items: initialItems, canEdit }: Props) {
  const services = kind === "services";
  const endpoint = `/api/painel/${services ? "servicos" : "locais-caixa"}`;
  const [items, setItems] = useState<CatalogItem[]>(initialItems);
  const [editing, setEditing] = useState<CatalogItem | "new" | null>(null);
  const [online, setOnline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const editor = useRef<HTMLDivElement>(null);
  const draft = editing && editing !== "new" ? editing : null;
  const service = draft && isService(draft) ? draft : null;
  const visible = items.filter((item) => item.name.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")));

  function edit(item: CatalogItem | "new") {
    setEditing(item);
    setOnline(item !== "new" && "sitePriceCents" in item && item.sitePriceCents !== null);
    setConflict(false);
    setUncertain(false);
    setMessage(null);
    requestAnimationFrame(() => {
      editor.current?.scrollIntoView({ block: "nearest" });
      editor.current?.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
    });
  }

  async function loadLatest() {
    setBusy(true);
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error?.message || "Não foi possível carregar o cadastro.");
      const fresh = result.data as CatalogItem[];
      setItems(fresh);
      if (uncertain) {
        setUncertain(false);
        setMessage({ error: false, text: "Lista atualizada abaixo. Confira se o cadastro já foi salvo antes de enviar novamente." });
        return;
      }
      const current = fresh.find((item) => item.id === draft?.id);
      if (!current) throw new Error("O cadastro não está mais disponível. Cancele esta edição e confira a lista.");
      edit(current);
      setMessage({ error: false, text: "Versão atual carregada. Confira os campos antes de salvar." });
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? error.message : "Falha ao carregar a versão atual." });
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || conflict || uncertain || !canEdit) return;
    const data = new FormData(event.currentTarget);
    const payload = {
      ...(draft ? { id: draft.id, version: draft.version } : {}),
      name: String(data.get("name") ?? "").trim(),
      description: String(data.get("description") ?? "").trim(),
      active: data.get("active") === "on",
      ...(services ? {
        sitePriceCents: online ? Number(String(data.get("sitePrice") ?? "").replace(/\D/g, "")) : null,
        gatePriceCents: Number(String(data.get("gatePrice") ?? "").replace(/\D/g, "")),
        ...(!draft ? { applyToOpenDates: data.get("applyToOpenDates") === "on" } : {}),
      } : {}),
    };
    setBusy(true);
    setMessage(null);
    let apiError = false;
    try {
      const response = await fetch(endpoint, {
        method: draft ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      const versionConflict = response.status === 409 && result.error?.code === "version_conflict";
      if (versionConflict) setConflict(true);
      if (!response.ok || !result.ok) {
        apiError = response.status < 500 && result.ok === false && typeof result.error?.message === "string";
        throw new Error(versionConflict
          ? "Outra pessoa alterou este cadastro. Sua edição foi mantida; carregue a versão atual para conferir as mudanças."
          : result.error?.message || "Não foi possível salvar. Confira os campos e tente novamente.");
      }
      const saved = (services ? result.data.service : result.data) as CatalogItem;
      setItems((previous) => [...previous.filter((item) => item.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
      setEditing(null);
      setMessage({ error: false, text: services && !draft && payload.applyToOpenDates
        ? `Serviço salvo e disponibilizado em ${result.data.appliedDates} data(s) com day use aberto.`
        : "Cadastro salvo." });
    } catch (error) {
      if (!apiError) setUncertain(true);
      setMessage({ error: true, text: apiError && error instanceof Error ? error.message
        : "Não foi possível confirmar se o cadastro foi salvo. Sua edição foi mantida. Confira a lista antes de enviar novamente." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1120px] space-y-6 text-[#123b63]">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{services ? "Serviços adicionais" : "Locais de caixa"}</h1>
          <p className="mt-2 max-w-[65ch] text-sm text-[#45647f]">{services
            ? "Defina os preços no site e na bilheteria e quais serviços estão ativos."
            : "Cadastre os locais disponíveis para abrir os caixas do parque."}</p>
        </div>
        {canEdit && <button type="button" className={buttonClass} disabled={busy || uncertain} onClick={() => edit("new")}>
          {services ? "Novo serviço" : "Novo local"}
        </button>}
      </header>

      {message && <div role={message.error ? "alert" : "status"} className={`rounded-lg border p-4 text-sm ${message.error ? "border-[#e6b7b7] bg-[#fff3f3] text-[#8a2525]" : "border-[#b8d8c0] bg-[#f2faf4] text-[#245735]"}`}>
        <p>{message.text}</p>
        {conflict && <button type="button" className={`${buttonClass} mt-3`} disabled={busy} onClick={loadLatest}>
          {busy ? "Carregando…" : "Descartar minha edição e carregar versão atual"}
        </button>}
        {uncertain && <button type="button" className={`${buttonClass} mt-3`} disabled={busy} onClick={loadLatest}>
          {busy ? "Carregando…" : "Conferir lista antes de tentar novamente"}
        </button>}
      </div>}

      {editing && canEdit && <div ref={editor} className="rounded-xl border border-[#d4dfeb] bg-white p-5">
        <h2 className="mb-5 text-lg font-bold">{draft ? `Editar ${services ? "serviço" : "local"}` : services ? "Novo serviço" : "Novo local"}</h2>
        <form key={draft ? `${draft.id}-${draft.version}` : "new"} onSubmit={save}>
          <fieldset disabled={busy} className="space-y-4">
            <label className="block space-y-1 text-sm font-semibold"> <span>Nome</span>
              <input className={fieldClass} name="name" maxLength={120} required defaultValue={draft?.name ?? ""} />
            </label>
            <label className="block space-y-1 text-sm font-semibold"><span>Descrição</span>
              <textarea className={fieldClass} name="description" rows={2} maxLength={1000} defaultValue={draft?.description ?? ""} />
            </label>
            {services && <>
              <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={online} onChange={(event) => setOnline(event.target.checked)} />Vender também no site</label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1 text-sm font-semibold"><span>Valor na bilheteria (R$)</span>
                  <CurrencyInput className={fieldClass} name="gatePrice" required defaultValue={String(service?.gatePriceCents ?? 0)} />
                </label>
                {online && <label className="block space-y-1 text-sm font-semibold"><span>Valor no site (R$)</span>
                  <CurrencyInput className={fieldClass} name="sitePrice" required defaultValue={String(service?.sitePriceCents ?? 0)} />
                </label>}
              </div>
              {!online && <p className="text-sm text-[#45647f]">Sem valor no site: venda apenas na bilheteria.</p>}
              {!draft && <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="applyToOpenDates" />Disponibilizar nas datas atuais e futuras com day use aberto</label>}
            </>}
            <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="active" defaultChecked={draft?.active ?? true} />{services ? "Serviço ativo" : "Local ativo"}</label>
            <div className="flex flex-wrap gap-3 pt-2">
              <button type="submit" disabled={conflict || uncertain} className={`${buttonClass} bg-[#123b63] text-white hover:bg-[#204e76]`}>{busy ? "Salvando…" : "Salvar cadastro"}</button>
              <button type="button" className={buttonClass} onClick={() => { setEditing(null); setConflict(false); setUncertain(false); setMessage(null); }}>Cancelar</button>
            </div>
          </fieldset>
        </form>
      </div>}

      <section className="rounded-xl border border-[#d4dfeb] bg-white p-5" aria-label={services ? "Serviços cadastrados" : "Locais cadastrados"}>
        <label className="mb-5 block max-w-md space-y-1 text-sm font-semibold"><span>Buscar por nome</span>
          <input type="search" className={fieldClass} value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        {!visible.length ? <p className="py-8 text-sm text-[#45647f]">{items.length ? "Nenhum resultado para esta busca." : services ? "Nenhum serviço cadastrado." : "Nenhum local cadastrado."}</p> : <ul className="divide-y divide-[#d4dfeb]">
          {visible.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="min-w-0 flex-1 basis-48">
              <h2 className="break-words font-bold">{item.name}</h2>
              {item.description && <p className="mt-1 break-words text-sm text-[#45647f]">{item.description}</p>}
              <p className="mt-2 text-sm">{item.active ? "Ativo" : "Inativo"}</p>
            </div>
            {services && isService(item) && <dl className="grid grid-cols-2 gap-6 text-sm tabular-nums">
              <div><dt className="text-[#45647f]">Site</dt><dd className="mt-1 font-semibold">{item.sitePriceCents === null ? "Só na bilheteria" : money(item.sitePriceCents)}</dd></div>
              <div><dt className="text-[#45647f]">Bilheteria</dt><dd className="mt-1 font-semibold">{money(item.gatePriceCents)}</dd></div>
            </dl>}
            {canEdit && <button type="button" disabled={busy || uncertain} className={buttonClass} onClick={() => edit(item)} aria-label={`Editar ${item.name}`}>Editar</button>}
          </li>)}
        </ul>}
      </section>
    </div>
  );
}
