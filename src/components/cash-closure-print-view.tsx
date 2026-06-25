"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import type { CashClosurePrintModel } from "@/lib/ops-cash-print";

type Props = {
  model: CashClosurePrintModel;
};

function fmtMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function fmtInt(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  }).format(value);
}

function fmtDateTime(value: string | null, withSeconds = false) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    year: "numeric",
  }).format(date);
}

function renderPaymentRows(
  rows: Array<{
    label: string;
    method: string;
    value: number;
  }>,
) {
  return rows.length > 0 ? (
    <table className="table payments">
      <tbody>
        {rows.map((row) => (
          <tr key={`payment-${row.method}`}>
            <td>{row.label}:</td>
            <td className="value">R$ {fmtMoney(row.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : null;
}

function PageChrome({
  children,
  periodLabel,
  pill,
}: {
  children: ReactNode;
  periodLabel: string;
  pill: string;
}) {
  return (
    <div className="page">
      <div className="page-content">
        <div className="page-head">
          <h1>FECHAMENTO DE CAIXA</h1>
          <span className="pill">{pill}</span>
        </div>
        <div className="period-bar">
          <strong>PERIODO CONSIDERADO (HORA LOCAL):</strong> {periodLabel}
        </div>
        {children}
      </div>
    </div>
  );
}

export function CashClosurePrintView({ model }: Props) {
  const { report } = model;
  const periodLabel = `${fmtDateTime(model.openedAt, true)} → ${fmtDateTime(model.closedAt ?? model.createdAt, true)}`;
  const resumoDinheiro = report.summaryPaymentRows.find((row) => row.method === "dinhe")?.value ?? 0;
  const resumoMaquininha = report.summaryPaymentRows.reduce((sum, row) => {
    return row.method === "debit" || row.method === "credi" ? sum + row.value : sum;
  }, 0);
  const resumoPix = report.summaryPaymentRows.find((row) => row.method === "pix")?.value ?? 0;

  useEffect(() => {
    const afterPrint = () => {
      window.setTimeout(() => window.close(), 200);
    };

    window.addEventListener("afterprint", afterPrint);
    window.print();

    return () => {
      window.removeEventListener("afterprint", afterPrint);
    };
  }, []);

  return (
    <>
      <style jsx global>{`
        @page { size: A4 portrait; margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #d9d9d9; font: 12px Arial, sans-serif; color: #222; }
        .page { background: #fff; width: 210mm; margin: 12mm auto; box-shadow: 0 2px 10px rgba(0,0,0,.2); break-after: page; page-break-after: always; }
        .page:last-of-type { break-after: auto; page-break-after: auto; }
        .page-content { padding: 14mm; }
        .page-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .page-head h1 { font-size: 18px; font-weight: 700; }
        .pill { font-size: 11px; font-weight: 700; border: 1px solid #7fb6e6; color: #2d7cc2; padding: 4px 10px; border-radius: 999px; }
        .period-bar { background: #d9f3fb; padding: 6px 8px; border: 1px solid #b9e5f5; font-size: 11px; margin-bottom: 10px; }
        .grid { display: flex; gap: 12px; }
        .col { flex: 1; }
        .block { border: 1px solid #d4d4d4; margin-bottom: 10px; }
        .block-title { background: #e6e6e6; font-weight: 700; text-transform: uppercase; font-size: 11px; padding: 6px 8px; display: flex; justify-content: space-between; align-items: center; }
        .block-title .tag { font-weight: 700; }
        .table { width: 100%; border-collapse: collapse; }
        .table th, .table td { border: 1px solid #d4d4d4; padding: 4px 6px; font-size: 11px; }
        .table th { background: #f2f2f2; text-align: left; }
        .table td.right { text-align: right; }
        .table .total-row td { background: #f2f2f2; font-weight: 700; }
        .payments { border-top: 1px solid #d4d4d4; }
        .payments td { padding: 3px 6px; font-size: 11px; }
        .payments td.value { text-align: right; }
        @media print {
          body { background: #fff; }
          .page { margin: 0; box-shadow: none; width: auto; }
          .page-content { padding: 12mm; }
          .page:last-of-type { break-after: auto; page-break-after: auto; }
        }
      `}</style>

      <PageChrome periodLabel={periodLabel} pill="RESUMO">
        <div className="grid">
          <div className="col">
            <div className="block">
              <div className="block-title">
                INGRESSOS VALIDADOS: {report.kpis.people.siteValidatedCount}{" "}
                <span className="tag">SITE</span>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Tipo de ingresso</th>
                    <th>Quantidade</th>
                    <th>Valor total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.siteRows.map((row) => (
                    <tr key={`site-${row.voucherType}`}>
                      <td>{row.voucherTypeLabel}</td>
                      <td>{row.quantity}</td>
                      <td>R$ {fmtMoney(row.totalValue)}</td>
                    </tr>
                  ))}
                  {report.siteRows.length === 0 ? (
                    <tr>
                      <td className="right" colSpan={3}>- Nenhum validado -</td>
                    </tr>
                  ) : null}
                  <tr className="total-row">
                    <td><strong>TOTAL</strong></td>
                    <td><strong>{fmtInt(report.kpis.people.siteValidatedCount)}</strong></td>
                    <td className="right"><strong>R$ {fmtMoney(report.kpis.billing.site)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="block">
              <div className="block-title">
                INGRESSOS VENDIDOS: {report.boxOfficeCount}{" "}
                <span className="tag">BILHETERIA</span>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Tipo de ingresso</th>
                    <th>Quantidade</th>
                    <th>Valor total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.boxOfficeSummaryRows.map((row) => (
                    <tr key={`summary-${row.voucherType}`}>
                      <td>{row.voucherTypeLabel}</td>
                      <td>{row.quantity}</td>
                      <td>R$ {fmtMoney(row.totalValue)}</td>
                    </tr>
                  ))}
                  {report.boxOfficeSummaryRows.length === 0 ? (
                    <tr>
                      <td className="right" colSpan={3}>- Nenhum vendido -</td>
                    </tr>
                  ) : null}
                  <tr className="total-row">
                    <td><strong>TOTAL</strong></td>
                    <td><strong>{fmtInt(report.boxOfficeCount)}</strong></td>
                    <td className="right"><strong>R$ {fmtMoney(report.boxOfficeVoucherRevenue)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="col">
            <div className="block">
              <div className="block-title">CORTESIAS: {report.courtesyCount}</div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Autorizado por</th>
                    <th>Quantidade</th>
                  </tr>
                </thead>
                <tbody>
                  {report.courtesySummaryRows.map((row) => (
                    <tr key={`courtesy-summary-${row.authorizedBy}`}>
                      <td>{row.authorizedBy}</td>
                      <td className="right">{fmtInt(row.quantity)}</td>
                    </tr>
                  ))}
                  {report.courtesySummaryRows.length === 0 ? (
                    <tr>
                      <td className="right" colSpan={2}>- Nenhuma cortesia -</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="block">
              <div className="block-title">RESUMO FINANCEIRO</div>
              <table className="table">
                <tbody>
                  <tr>
                    <td>Total de vendas</td>
                    <td className="right">R$ {fmtMoney(report.kpis.billing.total)}</td>
                  </tr>
                  <tr>
                    <td>Site</td>
                    <td className="right">R$ {fmtMoney(report.kpis.billing.site)}</td>
                  </tr>
                  <tr>
                    <td>Dinheiro</td>
                    <td className="right">R$ {fmtMoney(resumoDinheiro)}</td>
                  </tr>
                  <tr>
                    <td>Maquininha</td>
                    <td className="right">R$ {fmtMoney(resumoMaquininha)}</td>
                  </tr>
                  {resumoPix > 0 ? (
                    <tr>
                      <td>Pix</td>
                      <td className="right">R$ {fmtMoney(resumoPix)}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="block">
              <div className="block-title">FUNDO DE CAIXA</div>
              <table className="table">
                <tbody>
                  <tr>
                    <td>Vendas</td>
                    <td className="right">R$ {fmtMoney(report.cashSales)}</td>
                  </tr>
                  {report.funds.map((row, index) => (
                    <tr key={`fund-${row.id}-${index}`}>
                      <td>Lancamento {index + 1} ({row.responsible})</td>
                      <td className="right">R$ {fmtMoney(row.numericValue)}</td>
                    </tr>
                  ))}
                  {report.sangrias.map((row, index) => (
                    <tr key={`sangria-${row.id}-${index}`}>
                      <td>Sangria {index + 1} ({row.responsible})</td>
                      <td className="right">R$ {fmtMoney(row.numericValue)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td><strong>Total no caixa</strong></td>
                    <td className="right"><strong>R$ {fmtMoney(report.cashInDrawer)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </PageChrome>

      <PageChrome periodLabel={periodLabel} pill="DETALHADO">
        <div className="grid">
          <div className="col">
            <div className="block">
              <div className="block-title">
                INGRESSOS VALIDADOS: {report.kpis.people.siteValidatedCount}{" "}
                <span className="tag">SITE</span>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Tipo de ingresso</th>
                    <th>Quantidade</th>
                    <th>Valor total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.siteRows.map((row) => (
                    <tr key={`detail-site-${row.voucherType}`}>
                      <td>{row.voucherTypeLabel}</td>
                      <td>{row.quantity}</td>
                      <td>R$ {fmtMoney(row.totalValue)}</td>
                    </tr>
                  ))}
                  {report.siteRows.length === 0 ? (
                    <tr>
                      <td className="right" colSpan={3}>- Nenhum validado -</td>
                    </tr>
                  ) : null}
                  <tr className="total-row">
                    <td><strong>TOTAL</strong></td>
                    <td><strong>{fmtInt(report.kpis.people.siteValidatedCount)}</strong></td>
                    <td className="right"><strong>R$ {fmtMoney(report.kpis.billing.site)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="block">
              <div className="block-title">CORTESIAS: {report.courtesyCount}</div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Autorizado por</th>
                    <th>Nome</th>
                    <th>Quantidade</th>
                  </tr>
                </thead>
                <tbody>
                  {report.courtesyRows.map((row, index) => (
                    <tr key={`courtesy-${row.authorizedBy}-${index}`}>
                      <td>{row.authorizedBy}</td>
                      <td>{row.identification}</td>
                      <td className="right">{fmtInt(row.quantity)}</td>
                    </tr>
                  ))}
                  {report.courtesyRows.length === 0 ? (
                    <tr>
                      <td className="right" colSpan={3}>- Nenhuma cortesia -</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="col">
            <div className="block">
              <div className="block-title">
                INGRESSOS VENDIDOS: {report.boxOfficeBaseCount}{" "}
                <span className="tag">BILHETERIA</span>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Tipo de ingresso</th>
                    <th>Quantidade</th>
                    <th>Valor total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.boxOfficeRows.map((row) => (
                    <tr key={`box-${row.voucherType}`}>
                      <td>{row.voucherTypeLabel}</td>
                      <td>{row.quantity}</td>
                      <td className="right">R$ {fmtMoney(row.totalValue)}</td>
                    </tr>
                  ))}
                  {report.boxOfficeRows.length === 0 ? (
                    <tr>
                      <td className="right" colSpan={3}>- Nenhum vendido -</td>
                    </tr>
                  ) : null}
                  <tr className="total-row">
                    <td><strong>TOTAL</strong></td>
                    <td><strong>{fmtInt(report.boxOfficeBaseCount)}</strong></td>
                    <td className="right"><strong>R$ {fmtMoney(report.boxOfficeBaseRevenue)}</strong></td>
                  </tr>
                </tbody>
              </table>
              {renderPaymentRows(report.boxOfficePaymentRows)}
            </div>

            {report.discountPanels.map((panel) => (
              <div className="block" key={panel.label}>
                <div className="block-title">
                  INGRESSOS VENDIDOS: {panel.quantity}{" "}
                  <span className="tag">{panel.label}</span>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tipo de ingresso</th>
                      <th>Quantidade</th>
                      <th>Valor total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {panel.rows.map((row, index) => (
                      <tr key={`${panel.label}-${row.voucherType}-${index}`}>
                        <td>{row.voucherTypeLabel}</td>
                        <td>{row.quantity}</td>
                        <td className="right">R$ {fmtMoney(row.totalValue)}</td>
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td><strong>TOTAL</strong></td>
                      <td><strong>{fmtInt(panel.quantity)}</strong></td>
                      <td className="right"><strong>R$ {fmtMoney(panel.totalValue)}</strong></td>
                    </tr>
                  </tbody>
                </table>
                {renderPaymentRows(panel.paymentRows)}
              </div>
            ))}
          </div>
        </div>
      </PageChrome>
    </>
  );
}
