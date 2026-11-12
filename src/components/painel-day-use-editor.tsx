"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { OperationalDay, OperationalTicketType } from "@/lib/operational-day";
import type { OperationalService } from "@/lib/operational-day-contract";
import { getSaoPauloToday, voucherValidityRange, type OperationalValidity } from "@/lib/operational-date";

type Props = {
  day: OperationalDay;
  priceTables: { id: number; label: string }[];
  services: OperationalService[];
  canEdit: boolean;
};
const field = "w-full rounded-lg border border-[#b8cbdc] bg-white px-3 py-2.5 text-[#123b63] focus:outline-2 focus:outline-offset-2 focus:outline-[#236699] disabled:bg-[#edf2f7]";
const button = "rounded-lg border border-[#b8cbdc] px-4 py-2.5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#236699] disabled:opacity-50";
const dateLabel = (value: string) => value.split("-").reverse().join("/");
const ticketLabels: Record<OperationalTicketType, string> = { norma: "Adulto", infan: "Criança", isent: "Isento" };

export function PainelDayUseEditor({ day: initialDay, priceTables, services, canEdit }: Props) {
  const [day, setDay] = useState(initialDay);
  const [validity, setValidity] = useState(initialDay.validity);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const readOnly = !canEdit || day.closed || day.date < getSaoPauloToday();
  const interval = voucherValidityRange(day.date, validity);
  const [year, month] = day.date.split("-");
  const returnHref = `/painel/agenda?mes=${Number(month)}&ano=${year}&dia=${day.date}`;

  async function reload() {
    setBusy(true);
    try {
      const response = await fetch(`/api/painel/dias?date=${day.date}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error?.message || "Não foi possível carregar a data.");
      setDay(result.data);
      setValidity(result.data.validity);
      setConflict(false);
      setFeedback({ error: false, text: "Programação atual carregada. Confira os campos antes de salvar." });
    } catch {
      setFeedback({ error: true, text: "Não foi possível carregar a programação. Seus campos foram mantidos; tente novamente quando a conexão voltar." });
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || conflict || readOnly) return;
    const form = new FormData(event.currentTarget);
    const limit = String(form.get("onlineLimit") ?? "").trim();
    const payload = {
      date: day.date, version: day.version,
      priceTableId: Number(form.get("priceTableId")),
      dayUseOpen: form.get("dayUseOpen") === "on", validity,
      onlineLimit: limit === "" ? null : Number(limit),
      ticketTypes: form.getAll("ticketTypes"),
      serviceIds: form.getAll("serviceIds").map(Number),
      reason: String(form.get("reason") ?? "").trim(),
    };
    setBusy(true);
    setFeedback(null);
    let apiError = false;
    try {
      const response = await fetch("/api/painel/dias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        apiError = response.status < 500 && typeof result.error?.message === "string";
        if (result.error?.code === "version_conflict") setConflict(true);
        throw new Error(result.error?.message || "Não foi possível salvar a programação.");
      }
      setDay(result.data);
      setFeedback({ error: false, text: "Day use salvo. As compras já realizadas mantêm os valores e a validade vendidos." });
    } catch (error) {
      if (!apiError) setConflict(true);
      setFeedback({ error: true, text: apiError && error instanceof Error ? error.message
        : "Não foi possível confirmar a gravação. Confira a versão atual antes de enviar novamente." });
    } finally {
      setBusy(false);
    }
  }

  return <div className="mx-auto max-w-[800px] space-y-5 text-[#123b63]">
    <Link className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4" href={returnHref}>Voltar à agenda</Link>
    <header>
      <h1 className="text-2xl font-bold">Day use · {dateLabel(day.date)}</h1>
      <p className="mt-2 text-sm text-[#45647f]">Preços, ingressos e serviços disponíveis nesta data.</p>
    </header>
    {day.closed && <p role="status" className="rounded-lg border border-[#d4dfeb] bg-white p-4 text-sm">Dia finalizado. A programação está disponível somente para consulta.</p>}
    {feedback && <div role={feedback.error ? "alert" : "status"} className={`rounded-lg border p-4 text-sm ${feedback.error ? "border-[#e6b7b7] bg-[#fff3f3] text-[#8a2525]" : "border-[#b8d8c0] bg-[#f2faf4] text-[#245735]"}`}>
      <p>{feedback.text}</p>
      {conflict && <button className={`${button} mt-3`} type="button" disabled={busy} onClick={reload}>Descartar edição e carregar versão atual</button>}
    </div>}
    <form key={`${day.date}-${day.version}`} onSubmit={save} className="rounded-xl border border-[#d4dfeb] bg-white p-5">
      <fieldset disabled={busy || readOnly} className="space-y-5">
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" name="dayUseOpen" defaultChecked={day.dayUseOpen} />Day use aberto</label>
        {day.onlineSoldOut ? <p role="status" className="text-sm text-[#8a2525]">Esgotado para novas vendas; aberto para uso de ingressos válidos. Alterar preços ou validade mantém as vendas encerradas.</p> : null}
        <p className="text-sm text-[#45647f]">Fechar a oferta retira esta data do site. Ingressos já comprados não são cancelados.</p>
        <label className="block space-y-1 text-sm font-semibold"><span>Tabela de preço da data</span>
          <select name="priceTableId" className={field} required defaultValue={day.priceTableId ?? ""}>
            <option value="" disabled>Selecione uma tabela</option>
            {priceTables.map((table) => <option key={table.id} value={table.id}>{table.label}</option>)}
          </select>
        </label>
        <label className="block space-y-1 text-sm font-semibold"><span>Validade dos novos ingressos</span>
          <select name="validity" className={field} value={validity} onChange={(event) => setValidity(event.target.value as OperationalValidity)}>
            <option value="day">Somente na data escolhida</option><option value="7_days">7 dias</option><option value="30_days">30 dias</option><option value="6_months">6 meses</option>
          </select>
        </label>
        <p className="text-sm text-[#45647f]">Uma utilização de <strong>{dateLabel(interval.validFrom)}</strong> até <strong>{dateLabel(interval.validUntil)}</strong>, inclusive, em qualquer dia com day use aberto, sem reagendamento.</p>
        <label className="block space-y-1 text-sm font-semibold"><span>Limite de pessoas nas vendas online</span>
          <input name="onlineLimit" type="number" inputMode="numeric" min={0} max={2147483647} step={1} className={field} defaultValue={day.onlineLimit ?? ""} />
        </label>
        <p className="text-sm text-[#45647f]">Em branco: sem limite. Zero: sem novas vendas online. Isentos contam como uma vaga; vendas dos caixas ficam fora deste limite.</p>
        <fieldset className="space-y-2"><legend className="mb-2 text-sm font-bold">Ingressos à venda</legend>
          {(Object.keys(ticketLabels) as OperationalTicketType[]).map((type) => <label key={type} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="ticketTypes" value={type} defaultChecked={day.ticketTypes.includes(type)} />{ticketLabels[type]}</label>)}
        </fieldset>
        <fieldset className="space-y-2"><legend className="mb-2 text-sm font-bold">Serviços adicionais</legend>
          {services.length ? services.map((service) => <label key={service.id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="serviceIds" value={service.id} defaultChecked={day.serviceIds.includes(service.id)} />
            <span>{service.name}{!service.active ? " (inativo — remova da seleção)" : service.sitePriceCents === null ? " · só na bilheteria" : ""}</span>
          </label>) : <p className="text-sm text-[#45647f]">Nenhum serviço cadastrado.</p>}
        </fieldset>
        {!readOnly && <>
          <label className="block space-y-1 text-sm font-semibold"><span>Motivo da alteração</span><textarea name="reason" rows={2} maxLength={1000} required className={field} /></label>
          <button type="submit" disabled={conflict} className={`${button} bg-[#123b63] text-white hover:bg-[#204e76]`}>{busy ? "Salvando…" : "Salvar day use"}</button>
        </>}
      </fieldset>
    </form>
  </div>;
}
