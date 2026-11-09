"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import type { ChargebackAutomationStatus } from "@/lib/chargeback-contract";
import type { ChargebackCaseSummary } from "@/lib/chargeback-repository";

const pageSize = 20;
const linkClass = "font-semibold text-[#1d68a2] underline";
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

const statusLabels: Record<string, string> = {
  queued: "Na fila",
  retry: "Aguardando nova tentativa",
  exception: "Exceção",
  submitting: "Apresentando defesa",
  uncertain: "Envio a confirmar",
  submitted: "Defesa apresentada",
  remote_done: "Tratada na Cielo",
  resolved: "Finalizada na Cielo",
  rejected: "Envio bloqueado",
};

function formatDate(value: string | null) {
  if (!value) return "Não informado";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split("-").reverse().join("/");

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTime.format(date);
}

export function ChargebackCaseList({ items }: { items: ChargebackCaseSummary[] }) {
  if (items.length === 0) return <p>Nenhuma contestação nesta página.</p>;

  return (
    <ul className="grid gap-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-[6px] border border-[#d4dde5] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-[#205a7f]">Caso Cielo {item.idCase}</h3>
            <span className="rounded-full bg-[#eaf2f7] px-3 py-1 font-semibold text-[#205a7f]">
              {Object.hasOwn(statusLabels, item.status) ? statusLabels[item.status] : item.status}
            </span>
          </div>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="font-semibold">Prazo Cielo</dt>
              <dd>{formatDate(item.deadline)}</dd>
            </div>
            <div>
              <dt className="font-semibold">Compra</dt>
              <dd>{item.purchaseId ? (
                <Link className={linkClass} href={`/painel/compras/${item.purchaseId}#contestacoes`}>
                  #{item.purchaseId}
                </Link>
              ) : "Sem vínculo"}</dd>
            </div>
            <div>
              <dt className="font-semibold">ID da contestação</dt>
              <dd>{item.idChargeback}</dd>
            </div>
            <div>
              <dt className="font-semibold">Estabelecimento</dt>
              <dd>{item.establishmentNumber}</dd>
            </div>
            <div>
              <dt className="font-semibold">Motivo Cielo</dt>
              <dd>{item.reason || "Não informado"}</dd>
            </div>
            <div>
              <dt className="font-semibold">Valor da transação</dt>
              <dd>{item.amount ? `R$ ${item.amount.replace(".", ",")}` : "Não informado"}</dd>
            </div>
            <div>
              <dt className="font-semibold">Última sincronização com a Cielo</dt>
              <dd>{formatDate(item.lastSyncedAt)}</dd>
            </div>
            <div>
              <dt className="font-semibold">Estado na Cielo</dt>
              <dd>{item.remoteStatus || "Não informado"}</dd>
            </div>
            {item.resultMessage && (
              <div>
                <dt className="font-semibold">Último retorno da Cielo</dt>
                <dd>{item.resultMessage}</dd>
              </div>
            )}
            {item.submittedAt && (
              <div>
                <dt className="font-semibold">Defesa apresentada em</dt>
                <dd>{formatDate(item.submittedAt)}</dd>
              </div>
            )}
          </dl>
          {item.issue && <p className="mt-3 font-semibold text-[#9f3d2f]">Pendência: {item.issue}</p>}
          <div className="mt-3">
            {item.hasDossier ? (
              <a className={linkClass} href={`/api/painel/contestacoes/${item.id}/dossie`}>
                Baixar dossiê (PDF)
              </a>
            ) : "Dossiê ainda não arquivado."}
          </div>
        </li>
      ))}
    </ul>
  );
}

const automationLabels: Record<ChargebackAutomationStatus["status"], string> = {
  disabled: "Automação desligada. Nenhuma defesa será enviada automaticamente.",
  healthy: "Automação ativa. Última execução concluída sem falha técnica registrada.",
  stale: "Atenção: a automação está há mais de 15 minutos sem uma execução bem-sucedida.",
  failed: "Atenção: a última execução terminou com falha ou pendência.",
  missing: "Atenção: a automação está habilitada, mas ainda não há execução agendada registrada.",
  unavailable: "Não foi possível consultar a saúde da automação.",
};

export function ChargebackAutomationSummary({ automation }: { automation: ChargebackAutomationStatus }) {
  return (
    <div role="status" className="rounded-[6px] border border-[#d4dde5] bg-[#f5f8fa] p-4">
      <p className="font-semibold">{automationLabels[automation.status]}</p>
      {automation.enabled && (
        <dl className="mt-2 grid gap-1">
          <div><dt className="inline font-semibold">Última execução: </dt><dd className="inline">{formatDate(automation.lastRunAt)}</dd></div>
          <div><dt className="inline font-semibold">Última execução bem-sucedida: </dt><dd className="inline">{formatDate(automation.lastSuccessAt)}</dd></div>
        </dl>
      )}
      <p className="mt-2">Use Atualizar consulta para conferir o estado atual. O resultado da defesa deve ser acompanhado no retorno de cada caso.</p>
    </div>
  );
}

type ListResult = { items: ChargebackCaseSummary[]; total: number; automation?: ChargebackAutomationStatus };
type ListState = { key: string; result: ListResult | null };

export function PainelCompraContestacoes({ purchaseId }: { purchaseId?: number }) {
  const endpoint = purchaseId
    ? `/api/painel/compras/${purchaseId}/contestacoes`
    : "/api/painel/contestacoes";
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<ListState | null>(null);
  const url = `${endpoint}?offset=${offset}`;
  const key = `${url}#${refresh}`;
  const current = state?.key === key ? state : null;
  const total = state?.result?.total ?? 0;
  const hasNextPage = offset + pageSize < total;

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error();
        const result = await response.json() as ListResult;
        if (!controller.signal.aborted) setState({ key, result });
      } catch {
        if (!controller.signal.aborted) setState({ key, result: null });
      }
    })();

    return () => controller.abort();
  }, [key, url]);

  return (
    <section id="contestacoes" className="grid gap-4 rounded-[6px] border border-[#d4dde5] bg-white p-4 text-sm text-[#345062] md:p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[#205a7f]">Contestações Cielo</h2>
        {purchaseId && (
          <Link className={linkClass} href="/painel/compras/contestacoes">Ver todas as contestações</Link>
        )}
        <button className={linkClass} type="button" onClick={() => setRefresh((value) => value + 1)}>
          Atualizar consulta
        </button>
      </header>
      {!purchaseId && current?.result?.automation && <ChargebackAutomationSummary automation={current.result.automation} />}
      {!current ? <p role="status">Carregando contestações…</p> : current.result ? (
        <ChargebackCaseList items={current.result.items} />
      ) : <p role="alert">Consulta de contestações indisponível.</p>}
      {(offset > 0 || total > pageSize) && (
        <nav aria-label="Páginas de contestações" className="flex flex-wrap items-center gap-4">
          <button
            aria-disabled={offset === 0}
            className={`${linkClass} aria-disabled:opacity-60`}
            type="button"
            onClick={() => {
              if (offset > 0) setOffset(offset - pageSize);
            }}
          >
            Anterior
          </button>
          <span aria-live="polite">Página {offset / pageSize + 1}{current?.result && ` · ${total} casos`}</span>
          <button
            aria-disabled={!hasNextPage}
            className={`${linkClass} aria-disabled:opacity-60`}
            type="button"
            onClick={() => {
              if (hasNextPage) setOffset(offset + pageSize);
            }}
          >
            Próxima
          </button>
        </nav>
      )}
    </section>
  );
}
