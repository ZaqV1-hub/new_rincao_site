"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BilheteriaCashHeader } from "@/components/bilheteria-cash-header";
import {
  formatBilheteriaCashDateTime,
  formatBilheteriaCashMoney,
  type BilheteriaCashClosureReportModel,
} from "@/lib/bilheteria-cash-view-model";

type Props = {
  actorCpf?: string | null;
  actorName?: string | null;
  closureId: number | null;
  isHistorical: boolean;
  isManager: boolean;
  printHref: string | null;
  report: BilheteriaCashClosureReportModel;
};

type CloseCashResponse = {
  ok: true;
  data: {
    closure: {
      id: number;
    };
    message: string;
  };
} | {
  ok: false;
  error: {
    message: string;
  };
};

export function BilheteriaCashClosurePage({
  actorCpf = null,
  actorName = null,
  closureId,
  isHistorical,
  isManager,
  printHref,
  report,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"resumo" | "detalhado">("resumo");
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fundRows = useMemo(() => report.funds, [report.funds]);
  const sangriaRows = useMemo(() => report.sangrias, [report.sangrias]);
  const effectivePrintHref =
    printHref ?? (closureId ? `/painel/fechamentos/${closureId}/imprimir` : "/painel/fechamentos/imprimir");

  function openPrintWindow(url: string) {
    const w = 900;
    const h = 1000;
    const left = Math.max(0, (window.innerWidth - w) / 2 + window.screenX);
    const top = Math.max(0, (window.innerHeight - h) / 2 + window.screenY);
    const printWin = window.open(
      url,
      "fechamentoCaixaPrint",
      `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`,
    );

    if (!printWin) {
      window.location.href = url;
      return;
    }

    try {
      printWin.opener = null;
    } catch {}
  }

  function handleCloseCash(formData: FormData) {
    const operatorName = String(formData.get("operatorName") ?? "").trim();
    startTransition(async () => {
      setFeedback(null);

      try {
        const response = await fetch("/api/painel/bilheteria/cash-closures", {
          body: JSON.stringify({
            actor: {
              cpf: actorCpf,
              name: actorName,
            },
            operatorName,
            reason: "Fechamento realizado pela tela dedicada da bilheteria.",
          }),
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          method: "POST",
        });

        const payload = (await response.json().catch(() => null)) as CloseCashResponse | null;
        if (!response.ok || !payload || !payload.ok) {
          setFeedback({
            tone: "error",
            message:
              payload && !payload.ok
                ? payload.error.message
                : "Nao foi possivel fechar o caixa agora.",
          });
          return;
        }

        setFeedback({
          tone: "success",
          message: payload.data.message,
        });
        setShowCloseModal(false);
        openPrintWindow(`/painel/fechamentos/${payload.data.closure.id}/imprimir`);
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao fechar o caixa.",
        });
      }
    });
  }

  function renderPaymentSummaryRows(
    rows: Array<{
      label: string;
      method: string;
      value: number;
    }>,
  ) {
    if (rows.length === 0) {
      return null;
    }

    return (
      <div className="overflow-x-auto border-x border-b border-[#d2dde6]">
        <table className="min-w-full border-collapse text-sm">
          <tbody>
            {rows.map((row) => (
              <tr key={`payment-row-${row.method}`}>
                <td className="border border-[#d2dde6] px-4 py-2.5">{row.label}:</td>
                <td className="border border-[#d2dde6] px-4 py-2.5 text-right">
                  {formatBilheteriaCashMoney(row.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <BilheteriaCashHeader
        actorName={actorName}
        primaryActions={[
          { href: "/painel/bilheteria/vendas", label: "Vendas" },
        ]}
      />

      <section className="panel-section grid gap-5 p-5 print:bg-white print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="panel-eyebrow">Caixa</p>
            <h1 className="text-[28px] font-black leading-tight text-[#17351f]">
              Fechamento de caixa
            </h1>
            {isHistorical ? <p className="mt-1 text-sm text-[#5a6b5d]">Historico salvo</p> : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isManager ? (
              <>
                <Link
                  className="panel-button-secondary"
                  href="/painel/bilheteria/fechamento-caixa/historico"
                >
                  Historico
                </Link>
                <Link
                  className="panel-button-secondary"
                  href={
                    closureId
                      ? `/painel/bilheteria/fechamento-caixa/edicoes?fechamento_id=${closureId}`
                      : "/painel/bilheteria/fechamento-caixa/edicoes"
                  }
                >
                  Edicoes
                </Link>
              </>
            ) : null}
            <div className="inline-flex rounded-[8px] border border-[#dbe7d7] bg-[#f6faf3] p-1">
              <button
                className={`rounded-[6px] px-4 py-2 text-sm font-bold ${
                  activeTab === "resumo"
                    ? "bg-[#2b8c46] text-white"
                    : "text-[#426048]"
                }`}
                onClick={() => setActiveTab("resumo")}
                type="button"
              >
                Resumo
              </button>
              <button
                className={`rounded-[6px] px-4 py-2 text-sm font-bold ${
                  activeTab === "detalhado"
                    ? "bg-[#2b8c46] text-white"
                    : "text-[#426048]"
                }`}
                onClick={() => setActiveTab("detalhado")}
                type="button"
              >
                Detalhado
              </button>
            </div>
          </div>
        </div>

        {feedback ? (
          <div
            className={`border px-4 py-3 text-sm ${
              feedback.tone === "success"
                ? "border-[#b7dfc0] bg-[#edf8f0] text-[#245336]"
                : "border-[#efc0c0] bg-[#fff0f0] text-[#7a2b2b]"
            }`}
          >
            {feedback.message}
          </div>
        ) : null}

        <div className="rounded-[8px] border border-[#dbe7d7] bg-[#f6faf3] px-4 py-3 text-sm text-[#314c36]">
          <strong className="block text-xs uppercase tracking-[0.06em]">
            Periodo considerado
          </strong>
          {formatBilheteriaCashDateTime(report.period.openedAt)} &rarr;{" "}
          {formatBilheteriaCashDateTime(report.period.closedAt)}
        </div>

        <div className="grid gap-4 xl:grid-cols-4">
          <article className="overflow-hidden rounded-[8px] border border-[#dbe7d7] bg-white p-5 shadow-none">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#5f7387]">
              Publico
            </span>
            <strong className="mt-3 block text-4xl font-bold text-[#204b71]">
              {report.kpis.people.total}
            </strong>
            <small className="mt-3 block text-sm text-[#5f7387]">
              Site {report.kpis.people.siteValidatedCount} + Bilheteria{" "}
              {report.kpis.people.boxOfficeCount} + Cortesias{" "}
              {report.kpis.people.courtesyCount}
            </small>
          </article>
          <article className="overflow-hidden rounded-[6px] border border-[#d8e3ef] bg-white p-5 shadow-[0_8px_22px_rgba(36,76,114,0.08)]">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#5f7387]">
              Faturamento total
            </span>
            <strong className="mt-3 block text-4xl font-bold text-[#204b71]">
              {formatBilheteriaCashMoney(report.kpis.billing.total)}
            </strong>
            <small className="mt-3 block text-sm text-[#5f7387]">
              Site {formatBilheteriaCashMoney(report.kpis.billing.site)} + Bilheteria{" "}
              {formatBilheteriaCashMoney(report.kpis.billing.boxOffice)}
            </small>
          </article>
          <article className="overflow-hidden rounded-[6px] border border-[#d8e3ef] bg-white p-5 shadow-[0_8px_22px_rgba(36,76,114,0.08)]">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#5f7387]">
              Dinheiro no caixa
            </span>
            <strong className="mt-3 block text-4xl font-bold text-[#204b71]">
              {formatBilheteriaCashMoney(report.kpis.cashInDrawer)}
            </strong>
            <small className="mt-3 block text-sm text-[#5f7387]">
              Dinheiro em vendas, fundos e sangrias do periodo.
            </small>
          </article>
          <article className="overflow-hidden rounded-[6px] border border-[#d8e3ef] bg-white p-5 shadow-[0_8px_22px_rgba(36,76,114,0.08)]">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#5f7387]">
              Ticket medio do dia
            </span>
            <strong className="mt-3 block text-4xl font-bold text-[#204b71]">
              {formatBilheteriaCashMoney(report.kpis.averageTicket)}
            </strong>
            <small className="mt-3 block text-sm text-[#5f7387]">
              Faturamento total dividido por {report.kpis.people.total} pessoas.
            </small>
          </article>
        </div>

        {activeTab === "resumo" ? (
          <div className="grid gap-6 xl:grid-cols-2">
            <article className="rounded-[6px] border border-[#d8e3ef] bg-white shadow-[0_10px_22px_rgba(29,70,109,0.06)]">
              <div className="border-b border-[#d8e3ef] bg-[linear-gradient(180deg,#fff_0%,#f1f7fc_100%)] px-4 py-4 text-lg font-bold text-[#224b71]">
                Passaportes validados: {report.kpis.people.siteValidatedCount}
                <span className="ml-2 inline-flex rounded-full border border-[#bed6eb] bg-[#f4faff] px-3 py-1 text-xs font-bold uppercase tracking-[0.04em] text-[#335f82]">
                  SITE
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-[#5f84a3] text-left text-white">
                    <tr>
                      <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Passaporte</th>
                      <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Quantidade</th>
                      <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Valor total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.siteRows.length > 0 ? (
                      report.siteRows.map((row) => (
                        <tr key={`site-${row.voucherType}`}>
                          <td className="border border-[#d2dde6] px-4 py-3">{row.voucherTypeLabel}</td>
                          <td className="border border-[#d2dde6] px-4 py-3">{row.quantity}</td>
                          <td className="border border-[#d2dde6] px-4 py-3">
                            {formatBilheteriaCashMoney(row.totalValue)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-5 text-center text-[#5f7387]" colSpan={3}>
                          - Nenhum passaporte validado -
                        </td>
                      </tr>
                    )}
                    <tr className="bg-[#f7fbff] font-bold text-[#224b71]">
                      <td className="border border-[#d2dde6] px-4 py-3">TOTAL</td>
                      <td className="border border-[#d2dde6] px-4 py-3">{report.kpis.people.siteValidatedCount}</td>
                      <td className="border border-[#d2dde6] px-4 py-3">
                        {formatBilheteriaCashMoney(report.kpis.billing.site)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>

            <article className="rounded-[6px] border border-[#d8e3ef] bg-white shadow-[0_10px_22px_rgba(29,70,109,0.06)]">
              <div className="border-b border-[#d8e3ef] bg-[linear-gradient(180deg,#fff_0%,#f1f7fc_100%)] px-4 py-4 text-lg font-bold text-[#224b71]">
                Passaportes vendidos: {report.boxOfficeCount}
                <span className="ml-2 inline-flex rounded-full border border-[#bed6eb] bg-[#f4faff] px-3 py-1 text-xs font-bold uppercase tracking-[0.04em] text-[#335f82]">
                  BILHETERIA
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-[#5f84a3] text-left text-white">
                    <tr>
                      <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Passaporte</th>
                      <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Quantidade</th>
                      <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Valor total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.boxOfficeSummaryRows.length > 0 ? (
                      report.boxOfficeSummaryRows.map((row) => (
                        <tr key={`summary-${row.voucherType}`}>
                          <td className="border border-[#d2dde6] px-4 py-3">{row.voucherTypeLabel}</td>
                          <td className="border border-[#d2dde6] px-4 py-3">{row.quantity}</td>
                          <td className="border border-[#d2dde6] px-4 py-3">
                            {formatBilheteriaCashMoney(row.totalValue)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-5 text-center text-[#5f7387]" colSpan={3}>
                          - Nenhum passaporte vendido -
                        </td>
                      </tr>
                    )}
                    <tr className="bg-[#f7fbff] font-bold text-[#224b71]">
                      <td className="border border-[#d2dde6] px-4 py-3">TOTAL</td>
                      <td className="border border-[#d2dde6] px-4 py-3">{report.boxOfficeCount}</td>
                      <td className="border border-[#d2dde6] px-4 py-3">
                        {formatBilheteriaCashMoney(report.boxOfficeVoucherRevenue)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>

            <article className="rounded-[6px] border border-[#d8e3ef] bg-white shadow-[0_10px_22px_rgba(29,70,109,0.06)]">
              <div className="border-b border-[#d8e3ef] bg-[linear-gradient(180deg,#fff_0%,#f1f7fc_100%)] px-4 py-4 text-lg font-bold text-[#224b71]">
                Cortesias: {report.courtesyCount}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-[#5f84a3] text-left text-white">
                    <tr>
                      <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Autorizado por</th>
                      <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.courtesySummaryRows.length > 0 ? (
                      report.courtesySummaryRows.map((row) => (
                        <tr key={`courtesy-${row.authorizedBy}`}>
                          <td className="border border-[#d2dde6] px-4 py-3">{row.authorizedBy}</td>
                          <td className="border border-[#d2dde6] px-4 py-3">{row.quantity}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-5 text-center text-[#5f7387]" colSpan={2}>
                          - Nenhuma cortesia -
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="rounded-[6px] border border-[#d8e3ef] bg-white shadow-[0_10px_22px_rgba(29,70,109,0.06)]">
              <div className="border-b border-[#d8e3ef] bg-[linear-gradient(180deg,#fff_0%,#f1f7fc_100%)] px-4 py-4 text-lg font-bold text-[#224b71]">
                Resumo financeiro
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <tbody>
                    <tr>
                      <td className="border border-[#d2dde6] px-4 py-3">Total de vendas</td>
                      <td className="border border-[#d2dde6] px-4 py-3 text-right">
                        {formatBilheteriaCashMoney(report.kpis.billing.total)}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-[#d2dde6] px-4 py-3">Site</td>
                      <td className="border border-[#d2dde6] px-4 py-3 text-right">
                        {formatBilheteriaCashMoney(report.kpis.billing.site)}
                      </td>
                    </tr>
                    {report.summaryPaymentRows.map((row) => (
                      <tr key={`payment-${row.method}`}>
                        <td className="border border-[#d2dde6] px-4 py-3">{row.label}</td>
                        <td className="border border-[#d2dde6] px-4 py-3 text-right">
                          {formatBilheteriaCashMoney(row.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="rounded-[6px] border border-[#d8e3ef] bg-white shadow-[0_10px_22px_rgba(29,70,109,0.06)] xl:col-span-2">
              <div className="border-b border-[#d8e3ef] bg-[linear-gradient(180deg,#fff_0%,#f1f7fc_100%)] px-4 py-4 text-lg font-bold text-[#224b71]">
                Fundo de caixa
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <tbody>
                    <tr>
                      <td className="border border-[#d2dde6] px-4 py-3">Vendas</td>
                      <td className="border border-[#d2dde6] px-4 py-3 text-right">
                        {formatBilheteriaCashMoney(report.cashSales)}
                      </td>
                    </tr>
                    {fundRows.map((row, index) => (
                      <tr key={`fund-${row.id}`}>
                        <td className="border border-[#d2dde6] px-4 py-3">
                          Lancamento {index + 1} ({row.responsible})
                        </td>
                        <td className="border border-[#d2dde6] px-4 py-3 text-right">
                          {formatBilheteriaCashMoney(row.numericValue)}
                        </td>
                      </tr>
                    ))}
                    {sangriaRows.map((row, index) => (
                      <tr key={`sangria-${row.id}`}>
                        <td className="border border-[#d2dde6] px-4 py-3">
                          Sangria {index + 1} ({row.responsible})
                        </td>
                        <td className="border border-[#d2dde6] px-4 py-3 text-right">
                          {formatBilheteriaCashMoney(row.numericValue)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[#f7fbff] font-bold text-[#224b71]">
                      <td className="border border-[#d2dde6] px-4 py-3">Total no caixa</td>
                      <td className="border border-[#d2dde6] px-4 py-3 text-right">
                        {formatBilheteriaCashMoney(report.cashInDrawer)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-2">
            <article className="rounded-[6px] border border-[#d8e3ef] bg-white shadow-[0_10px_22px_rgba(29,70,109,0.06)]">
              <div className="border-b border-[#d8e3ef] bg-[linear-gradient(180deg,#fff_0%,#f1f7fc_100%)] px-4 py-4 text-lg font-bold text-[#224b71]">
                Passaportes validados: {report.kpis.people.siteValidatedCount}
                <span className="ml-2 inline-flex rounded-full border border-[#bed6eb] bg-[#f4faff] px-3 py-1 text-xs font-bold uppercase tracking-[0.04em] text-[#335f82]">
                  SITE
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-[#5f84a3] text-left text-white">
                    <tr>
                      <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Passaporte</th>
                      <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Quantidade</th>
                      <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Valor total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.siteRows.length > 0 ? (
                      report.siteRows.map((row) => (
                        <tr key={`detail-site-${row.voucherType}`}>
                          <td className="border border-[#d2dde6] px-4 py-3">{row.voucherTypeLabel}</td>
                          <td className="border border-[#d2dde6] px-4 py-3">{row.quantity}</td>
                          <td className="border border-[#d2dde6] px-4 py-3">
                            {formatBilheteriaCashMoney(row.totalValue)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-5 text-center text-[#5f7387]" colSpan={3}>
                          - Nenhum passaporte validado -
                        </td>
                      </tr>
                    )}
                    <tr className="bg-[#f7fbff] font-bold text-[#224b71]">
                      <td className="border border-[#d2dde6] px-4 py-3">TOTAL</td>
                      <td className="border border-[#d2dde6] px-4 py-3">{report.kpis.people.siteValidatedCount}</td>
                      <td className="border border-[#d2dde6] px-4 py-3">
                        {formatBilheteriaCashMoney(report.kpis.billing.site)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>

            <article className="rounded-[6px] border border-[#d8e3ef] bg-white shadow-[0_10px_22px_rgba(29,70,109,0.06)]">
              <div className="border-b border-[#d8e3ef] bg-[linear-gradient(180deg,#fff_0%,#f1f7fc_100%)] px-4 py-4 text-lg font-bold text-[#224b71]">
                Passaportes vendidos: {report.boxOfficeBaseCount}
                <span className="ml-2 inline-flex rounded-full border border-[#bed6eb] bg-[#f4faff] px-3 py-1 text-xs font-bold uppercase tracking-[0.04em] text-[#335f82]">
                  BILHETERIA
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-[#5f84a3] text-left text-white">
                    <tr>
                      <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Passaporte</th>
                      <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Quantidade</th>
                      <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Valor total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.boxOfficeRows.length > 0 ? (
                      report.boxOfficeRows.map((row) => (
                        <tr key={`detail-box-${row.voucherType}`}>
                          <td className="border border-[#d2dde6] px-4 py-3">{row.voucherTypeLabel}</td>
                          <td className="border border-[#d2dde6] px-4 py-3">{row.quantity}</td>
                          <td className="border border-[#d2dde6] px-4 py-3">
                            {formatBilheteriaCashMoney(row.totalValue)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-5 text-center text-[#5f7387]" colSpan={3}>
                          - Nenhum passaporte vendido -
                        </td>
                      </tr>
                    )}
                    <tr className="bg-[#f7fbff] font-bold text-[#224b71]">
                      <td className="border border-[#d2dde6] px-4 py-3">TOTAL</td>
                      <td className="border border-[#d2dde6] px-4 py-3">{report.boxOfficeBaseCount}</td>
                      <td className="border border-[#d2dde6] px-4 py-3">
                        {formatBilheteriaCashMoney(report.boxOfficeBaseRevenue)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {renderPaymentSummaryRows(report.boxOfficePaymentRows)}
            </article>

            <article className="rounded-[6px] border border-[#d8e3ef] bg-white shadow-[0_10px_22px_rgba(29,70,109,0.06)]">
              <div className="border-b border-[#d8e3ef] bg-[linear-gradient(180deg,#fff_0%,#f1f7fc_100%)] px-4 py-4 text-lg font-bold text-[#224b71]">
                Cortesias: {report.courtesyCount}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-[#5f84a3] text-left text-white">
                    <tr>
                      <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Autorizado por</th>
                      <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Nome</th>
                      <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.courtesyRows.length > 0 ? (
                      report.courtesyRows.map((row, index) => (
                        <tr key={`courtesy-row-${index}`}>
                          <td className="border border-[#d2dde6] px-4 py-3">{row.authorizedBy}</td>
                          <td className="border border-[#d2dde6] px-4 py-3">{row.identification}</td>
                          <td className="border border-[#d2dde6] px-4 py-3">{row.quantity}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-5 text-center text-[#5f7387]" colSpan={3}>
                          - Nenhuma cortesia -
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            {report.discountPanels.map((panel) => (
              <article
                key={panel.label}
                className="rounded-[6px] border border-[#d8e3ef] bg-white shadow-[0_10px_22px_rgba(29,70,109,0.06)]"
              >
                <div className="border-b border-[#d8e3ef] bg-[linear-gradient(180deg,#fff_0%,#f1f7fc_100%)] px-4 py-4 text-lg font-bold text-[#224b71]">
                  Passaportes vendidos: {panel.quantity}
                  <span className="ml-2 inline-flex rounded-full border border-[#bed6eb] bg-[#f4faff] px-3 py-1 text-xs font-bold uppercase tracking-[0.04em] text-[#335f82]">
                    {panel.label}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead className="bg-[#5f84a3] text-left text-white">
                      <tr>
                        <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Passaporte</th>
                        <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Quantidade</th>
                        <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Valor total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {panel.rows.map((row, index) => (
                        <tr key={`${panel.label}-${index}`}>
                          <td className="border border-[#d2dde6] px-4 py-3">{row.voucherTypeLabel}</td>
                          <td className="border border-[#d2dde6] px-4 py-3">{row.quantity}</td>
                          <td className="border border-[#d2dde6] px-4 py-3">
                            {formatBilheteriaCashMoney(row.totalValue)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-[#f7fbff] font-bold text-[#224b71]">
                        <td className="border border-[#d2dde6] px-4 py-3">TOTAL</td>
                        <td className="border border-[#d2dde6] px-4 py-3">{panel.quantity}</td>
                        <td className="border border-[#d2dde6] px-4 py-3">
                          {formatBilheteriaCashMoney(panel.totalValue)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {renderPaymentSummaryRows(panel.paymentRows)}
              </article>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
          <div className="text-sm text-[#5f7387]">
            {isHistorical
              ? "Visualizacao de um fechamento ja concluido."
              : "Revise os totais antes de imprimir ou concluir o fechamento do caixa."}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {effectivePrintHref ? (
              <button
                className="rounded-[4px] border border-[#2b6ea0] bg-[#2f7db8] px-4 py-2.5 text-sm font-bold text-white shadow-[0_1px_0_rgba(0,0,0,0.12)]"
                onClick={() => openPrintWindow(effectivePrintHref)}
                type="button"
              >
                Imprimir fechamento
              </button>
            ) : null}

            {!isHistorical ? (
              <button
                className="rounded-[4px] bg-[#d33c3c] px-4 py-3 text-sm font-bold text-white"
                onClick={() => setShowCloseModal(true)}
                type="button"
              >
                FECHAR CAIXA
              </button>
            ) : (
              <Link
                className="rounded-[4px] bg-[#6b7280] px-4 py-3 text-sm font-bold text-white"
                href="/painel/bilheteria/fechamento-caixa/historico"
              >
                Voltar
              </Link>
            )}
          </div>
        </div>
      </section>

      {showCloseModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-8">
          <form
            action={handleCloseCash}
            className="w-full max-w-[360px] rounded-[8px] bg-white p-5 shadow-[0_18px_40px_rgba(0,0,0,0.24)]"
          >
            <div className="flex items-center justify-between border-b border-[#e6edf3] pb-3">
              <h2 className="text-lg font-semibold text-[#1d3348]">Fechar Caixa</h2>
              <button
                className="text-2xl leading-none text-[#5f7387]"
                onClick={() => setShowCloseModal(false)}
                type="button"
              >
                ×
              </button>
            </div>
            <div className="grid gap-4 py-4">
              <label className="grid gap-2 text-sm font-semibold text-[#35576f]">
                Nome do operador
                <input
                  className="rounded-[4px] border border-[#cbd5df] px-3 py-2 text-sm text-[#1d3348]"
                  name="operatorName"
                  required
                />
              </label>
              <p className="text-sm text-[#1d3348]">Deseja fechar o caixa?</p>
            </div>
            <div className="flex justify-end gap-3 border-t border-[#e6edf3] pt-4">
              <button
                className="rounded-[8px] bg-[#e5e7eb] px-4 py-2 text-sm font-semibold text-[#1d3348]"
                onClick={() => setShowCloseModal(false)}
                type="button"
              >
                Nao
              </button>
              <button
                className="rounded-[8px] bg-[#246b99] px-4 py-2 text-sm font-semibold text-white"
                disabled={isPending}
                type="submit"
              >
                {isPending ? "Executando..." : "Sim"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
