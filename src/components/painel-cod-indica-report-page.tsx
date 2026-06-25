"use client";

import Link from "next/link";
import type { PainelCodIndicaReportData } from "@/lib/painel-cod-indica";

type Props = {
  codigo: string;
  dtini: string;
  dtfim: string;
  report: PainelCodIndicaReportData | null;
  error: string | null;
};

export function PainelCodIndicaReportPage({ codigo, dtini, dtfim, report, error }: Props) {
  return (
    <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
        <div className="border-b border-[#d8d8d8] pb-3 text-sm text-[#909090]">
          <Link className="text-[#1d68a2] underline" href="/painel">
            Home
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <Link className="text-[#1d68a2] underline" href="/painel/cod-indica">
            Cod Indica
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <Link className="text-[#1d68a2] underline" href={`/painel/cod-indica/${encodeURIComponent(codigo)}`}>
            {codigo}
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <span>Relatorio</span>
        </div>

        {error ? (
          <div className="mt-4 border border-[#efc0c0] bg-[#fff0f0] px-4 py-3 text-sm text-[#7a2b2b]">
            {error}
          </div>
        ) : null}

        <form action={`/painel/cod-indica/${encodeURIComponent(codigo)}/relatorio`} className="mt-6 grid gap-4 md:grid-cols-[1fr_1fr_auto]" method="get">
          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Dia Inicio
            <input
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
              defaultValue={dtini}
              name="dtini"
              type="date"
            />
          </label>
          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Dia Fim
            <input
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
              defaultValue={dtfim}
              name="dtfim"
              type="date"
            />
          </label>
          <div className="flex items-end">
            <button className="w-full bg-[#4aa329] px-6 py-3 text-sm font-semibold text-white" type="submit">
              Gerar relatorio
            </button>
          </div>
        </form>

        {report ? (
          <>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-[28px] font-semibold text-[#205a7f]">{report.representante}</h1>
                <p className="text-sm text-[#5a5a5a]">
                  Periodo: {report.dateFromLabel} ate {report.dateToLabel}
                </p>
              </div>
              <a
                className="inline-flex items-center justify-center rounded-full border border-[#c9d8e3] px-4 py-2 text-sm font-semibold text-[#205a7f]"
                href={`/api/painel/cod-indica/${encodeURIComponent(codigo)}/relatorio/pdf?dtini=${encodeURIComponent(report.dateFrom)}&dtfim=${encodeURIComponent(report.dateTo)}`}
                target="_blank"
              >
                Abrir PDF
              </a>
            </div>

            <div className="mt-4 border border-[#d7d7d7] bg-[#f8fbfd] p-4">
              <div className="text-xs uppercase tracking-[0.12em] text-[#6f7f8d]">Cashback total</div>
              <div className="mt-2 text-[28px] font-semibold text-[#205a7f]">
                R$ {report.totalCashbackLabel}
              </div>
            </div>

            <div className="mt-4 overflow-x-auto border border-[#cfcfcf]">
              <table className="min-w-full border-collapse text-[15px]">
                <thead className="bg-[#5f84a3] text-left text-white">
                  <tr>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Compra</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Titular</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">CPF</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Data pagamento</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Valor</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Desconto</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Cashback</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row, index) => (
                    <tr className={index % 2 === 1 ? "bg-[#fafafa]" : "bg-white"} key={row.purchaseId}>
                      <td className="border border-[#d7d7d7] px-4 py-3">{row.purchaseId}</td>
                      <td className="border border-[#d7d7d7] px-4 py-3">{row.buyerName}</td>
                      <td className="border border-[#d7d7d7] px-4 py-3">{row.cpfLabel}</td>
                      <td className="border border-[#d7d7d7] px-4 py-3">{row.paymentDateLabel}</td>
                      <td className="border border-[#d7d7d7] px-4 py-3">R$ {row.totalValueLabel}</td>
                      <td className="border border-[#d7d7d7] px-4 py-3">R$ {row.discountValueLabel}</td>
                      <td className="border border-[#d7d7d7] px-4 py-3">R$ {row.cashbackValueLabel}</td>
                      <td className="border border-[#d7d7d7] px-4 py-3">{row.cashbackTypeLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>

      <aside className="self-start rounded-[6px] border border-[#d7d7d7] bg-[#f6f7f8] p-4 shadow-[0_10px_28px_rgba(26,61,94,0.08)]">
        <ul className="space-y-3 text-[15px]">
          <li>
            <Link className="text-[#1d68a2] underline" href={`/painel/cod-indica/${encodeURIComponent(codigo)}`}>
              Voltar ao detalhe
            </Link>
          </li>
          <li>
            <Link className="text-[#1d68a2] underline" href="/painel/cod-indica">
              Lista de codigos
            </Link>
          </li>
        </ul>
      </aside>
    </section>
  );
}
