"use client";

import { useState } from "react";
import { SchoolPaymentReview } from "@/components/school-payment-review";
import Link from "next/link";
import { PainelCompraContestacoes } from "@/components/painel-compra-contestacoes";
import { PainelCompraDetailActions } from "@/components/painel-compra-detail-actions";
import { PainelPurchaseBatch } from "@/components/painel-purchase-batch";
import {
  formatPainelBilheteriaCpf as formatCpf,
} from "@/lib/painel-bilheteria-format";
import type { PainelPurchaseDetail } from "@/lib/painel-compras";
import { purchaseListHref, type PurchaseListContext } from "@/lib/operational-purchase-navigation";

type PainelCompraDetailPageProps = {
  detail: PainelPurchaseDetail;
  actorName: string | null;
  actorCpf: string | null;
  returnContext?: PurchaseListContext | null;
  canAccessCustomer?: boolean;
  canAccessSchool?: boolean;
  canOperateVouchers?: boolean;
};

function buildUserProfileHref(cpf: string | null) {
  const normalizedCpf = String(cpf ?? "").replace(/\D+/g, "");
  return normalizedCpf ? `/painel/usuario-site/${normalizedCpf}` : null;
}

export function PainelCompraDetailPage({
  detail,
  returnContext,
  canAccessCustomer = false,
  canAccessSchool = false,
  canOperateVouchers = false,
}: PainelCompraDetailPageProps) {
  const [selection, setSelection] = useState<number[]>([]);
  const [actionsBusy, setActionsBusy] = useState(false);
  const selectedIds = selection.filter((id) => detail.vouchers.some((voucher) => voucher.voucherId === id));
  const userProfileHref = canAccessCustomer ? buildUserProfileHref(detail.cpf) : null;
  const backHref = returnContext ? purchaseListHref(returnContext) : "/painel/compras";
  const operationalVouchers = new Map(detail.operational?.vouchers.map((voucher) => [voucher.voucherId, voucher]));
  const civilDate = (value: string | null | undefined) => value ? value.split("-").reverse().join("/") : "Não informado";
  const timestamp = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const paymentMethods: Record<string, string> = { dinhe: "Dinheiro", pix: "Pix", credi: "Crédito", debit: "Débito", tranb: "Transferência", bolet: "Boleto" };
  const cashPeriods = [...new Set(detail.operational?.payments.flatMap(payment => payment.periodId === null ? [] : [payment.periodId]) ?? [])];
  const origin = detail.type === 'bilhe' ? `Caixa${cashPeriods.length ? ` #${cashPeriods.join(', #')}` : ' · Bilheteria'}` : detail.operational?.origin === 'lumi' ? 'Lumi' : detail.type === 'ponli' ? 'Site' : detail.typeLabel;
  const visitDates = [...new Set(detail.vouchers.map(voucher => operationalVouchers.has(voucher.voucherId) ? civilDate(operationalVouchers.get(voucher.voucherId)?.visitDate) : voucher.visitDate ?? 'Não informado'))];
  const hasGateway = detail.type === 'ponli' || Boolean(detail.gatewayPaymentId);

  return (
    <section className="grid min-w-0 gap-5">
      <div className="min-w-0 rounded-xl border border-[#d9e3ee] bg-white p-5 md:p-6">
        <div className="border-b border-[#d8d8d8] pb-3 text-sm text-[#909090]">
          <Link className="text-[#1d68a2] underline" href="/painel">
            Home
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <Link className="text-[#1d68a2] underline" href={backHref}>
            {returnContext ? "Voltar às compras da data" : "Lista de compras / reservas"}
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <span>{detail.purchaseId}</span>
        </div>

        <header className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div><h1 className="text-2xl font-bold text-[#0f2d52]">Compra #{detail.purchaseId}</h1><p className="mt-1 text-[#6a7c92]">{detail.userName ?? 'Cliente não informado'} · CPF {formatCpf(detail.cpf)}</p></div>
          <span className="rounded-full bg-[#eaf2fb] px-3 py-1 text-sm font-semibold">{detail.statusLabel}</span>
        </header>
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[#e8eef5] pt-4 lg:grid-cols-4">
          {[['Data da visita',visitDates.join(', ')],['Compra feita em',detail.purchaseDate],['Tipo',detail.typeLabel],['Origem',origin],['Valor total',detail.totalValue],...(detail.paymentLabel && detail.paymentLabel !== '-' ? [['Pagamento',detail.paymentLabel]] : []),...(detail.paymentMethodLabel && detail.paymentMethodLabel !== '-' ? [['Forma de pagamento',detail.paymentMethodLabel]] : []),['Data de pagamento',[detail.paymentDate,detail.paymentTime].filter(Boolean).join(' ')],...(detail.referralCode ? [['Código de indicação',detail.referralCode]] : [])].map(([label,value]) => <div key={label}><dt className="text-xs font-semibold text-[#6a7c92]">{label}</dt><dd className="mt-1 break-words font-medium">{value || 'Não informado'}</dd></div>)}
        </dl>
        {userProfileHref && <Link className="mt-3 inline-flex min-h-11 items-center underline" href={userProfileHref}>Mais detalhes do cliente</Link>}

        {detail.gatewayPaymentId ? (
          <>
            <h2 className="mt-8 text-[28px] font-semibold text-[#205a7f]">Pagamento</h2>
            <div className="mt-4 overflow-x-auto border border-[#cfcfcf]">
              <table className="min-w-full border-collapse text-[15px]">
                <thead className="bg-[#eaf2fb] text-left text-[#0f2d52]">
                  <tr>
                    <th className="border border-[#d9e3ee] px-4 py-3 font-normal">
                      ID Pagamento
                    </th>
                    <th className="border border-[#d9e3ee] px-4 py-3 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-[#d7d7d7] px-4 py-3">
                      {detail.gatewayPaymentId}
                    </td>
                    <td className="border border-[#d7d7d7] px-4 py-3">
                      {detail.gatewayStatusCode
                        ? `Cielo ${detail.gatewayStatusCode} - ${detail.gatewayStatusLabel}`
                        : "-"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        <h2 className="mt-8 text-[28px] font-semibold text-[#205a7f]">Vouchers</h2>
        {detail.vouchers.length === 0 ? (
          <p className="mt-4 text-[17px] text-[#5a5a5a]">Nenhum voucher encontrado.</p>
        ) : (
          <div className="mt-4 overflow-x-auto border border-[#cfcfcf]">
            <table className="min-w-full border-collapse text-[15px]">
              <thead className="bg-[#eaf2fb] text-left text-[#0f2d52]">
                <tr>
                  <th className="border border-[#d9e3ee] px-4 py-3 font-normal"><input type="checkbox" aria-label="Selecionar todos os vouchers" disabled={actionsBusy} checked={detail.vouchers.length > 0 && selectedIds.length === detail.vouchers.length} onChange={(event) => setSelection(event.target.checked ? detail.vouchers.map((voucher) => voucher.voucherId) : [])} /></th>
                  <th className="border border-[#d9e3ee] px-4 py-3 font-normal">Voucher</th>
                  <th className="border border-[#d9e3ee] px-4 py-3 font-normal">Data da visita</th>
                  <th className="border border-[#d9e3ee] px-4 py-3 font-normal">Tipo</th>
                  <th className="border border-[#d9e3ee] px-4 py-3 font-normal">Valor</th>
                  <th className="border border-[#d9e3ee] px-4 py-3 font-normal">Usado?</th>
                </tr>
              </thead>
              <tbody>
                {detail.vouchers.map((voucher, index) => (
                  <tr
                    className={voucher.used === "s" ? "bg-[#eeeeee] text-[#68727b]" : index % 2 === 1 ? "bg-[#fafafa]" : "bg-white"}
                    key={voucher.voucherId}
                  >
                    <td className="border border-[#d7d7d7] px-4 py-3"><input type="checkbox" aria-label={`Selecionar voucher ${voucher.voucherNumber ?? voucher.voucherId}`} disabled={actionsBusy} checked={selectedIds.includes(voucher.voucherId)} onChange={(event) => setSelection(event.target.checked ? [...selectedIds, voucher.voucherId] : selectedIds.filter((id) => id !== voucher.voucherId))} /></td>
                    <td className="border border-[#d7d7d7] px-4 py-3">
                      <span className="inline-block min-w-[120px] bg-[#eaeaea] px-3 py-1 text-center font-mono text-sm">
                        {voucher.voucherNumber ?? "-"}
                      </span>
                    </td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{operationalVouchers.has(voucher.voucherId) ? civilDate(operationalVouchers.get(voucher.voucherId)?.visitDate) : voucher.visitDate ?? "-"}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3"><strong>{voucher.voucherTypeLabel}</strong><p className="text-sm">{voucher.studentName}</p>{voucher.schoolName && <p className="text-sm">{canAccessSchool && voucher.schoolTripHref ? <Link className="underline" href={voucher.schoolTripHref}>{voucher.schoolName}</Link> : voucher.schoolName}{voucher.className && ` · ${voucher.className}`}</p>}<p className="mt-1 text-xs text-[#6a7c92]">Validade: {operationalVouchers.get(voucher.voucherId)?.validFrom ? `${civilDate(operationalVouchers.get(voucher.voucherId)?.validFrom)} até ${civilDate(operationalVouchers.get(voucher.voucherId)?.validUntil)}` : operationalVouchers.get(voucher.voucherId)?.validUntil ? `Até ${civilDate(operationalVouchers.get(voucher.voucherId)?.validUntil)} · legado` : "Não registrada"}</p></td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{voucher.unitValue}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">
                      <span className={voucher.used === "n" ? "text-[#24733c]" : "font-bold text-[#68727b]"}>
                        {voucher.used === "inv"
                          ? "INVALIDADO"
                          : voucher.used === "s"
                            ? "USADO"
                            : voucher.used === "n"
                              ? "NÃO USADO"
                              : "INDISPONÍVEL"}
                      </span>
                      <p className="text-sm">{voucher.usedDate} {voucher.usedTime}</p>{voucher.used === "s" && <div className="mt-2 space-y-1 text-xs"><p>{operationalVouchers.get(voucher.voucherId)?.validation?.locationName ?? "Local não registrado"}</p><p>{operationalVouchers.get(voucher.voucherId)?.validation?.actorName ?? "Operador não registrado"}</p></div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4">
        <PainelCompraDetailActions
          purchaseId={detail.purchaseId}
          voucherIds={selectedIds}
          canOperate={canOperateVouchers}
          onBusyChange={setActionsBusy}
          onOperationComplete={() => setSelection([])}
        />
        </div>
        <section className="mt-8 space-y-4" aria-labelledby="purchase-receipts-title">
          <h2 id="purchase-receipts-title" className="text-xl font-semibold text-[#205a7f]">Recebimentos registrados</h2>
          {!detail.operational ? <p>Dados operacionais indisponíveis.</p> : detail.operational.payments.length === 0 ? <p>Nenhum recebimento individual registrado nesta fonte. Consulte também os dados de pagamento acima.</p> : <ul className="divide-y divide-[#d7d7d7]">{detail.operational.payments.map((payment) => <li key={payment.id} className="flex flex-wrap justify-between gap-3 py-3"><div><p>{paymentMethods[payment.method] ?? payment.method}</p><p className="text-sm text-[#5d7282]">{payment.receivedAt ? timestamp(payment.receivedAt) : "Data do recebimento não registrada"}{payment.periodId !== null && ` · Caixa #${payment.periodId}`}</p></div><strong>{money(payment.amountCents)}</strong></li>)}</ul>}
        </section>
        <section className="mt-8 space-y-4" aria-labelledby="purchase-history-title">
          <h2 id="purchase-history-title" className="text-xl font-semibold text-[#205a7f]">Histórico da compra</h2>
          {!detail.operational ? <p>Histórico indisponível.</p> : detail.operational.history.length === 0 ? <p>Nenhuma alteração registrada.</p> : <ol className="divide-y divide-[#d7d7d7]">{detail.operational.history.map((event) => <li key={event.id} className="space-y-1 py-3"><p className="font-semibold">{event.description}</p><p>{event.reason}</p><p className="text-sm text-[#5d7282]">{timestamp(event.occurredAt)} · {event.actorName ?? "Operador não informado"}</p></li>)}</ol>}
        </section>
        {hasGateway && <div className="mt-6">
          <PainelCompraContestacoes key={detail.purchaseId} purchaseId={detail.purchaseId} />
        </div>}
      </div>

      <aside className="grid content-start gap-5">
        <SchoolPaymentReview key={detail.purchaseId} purchaseId={detail.purchaseId} />
        <div className="rounded-[6px] border border-[#d4dde5] bg-white p-5 shadow-[0_10px_28px_rgba(26,61,94,0.08)]">
          <h2 className="text-lg font-semibold text-[#205a7f]">Ações</h2>
          <ul className="mt-4 grid gap-3 text-sm">
            <li>
              <Link className="text-[#1d68a2] underline" href={backHref}>
                {returnContext ? "Voltar às compras da data" : "Lista de compras / reservas"}
              </Link>
            </li>
            {hasGateway && <><li>
              <Link
                className="text-[#1d68a2] underline"
                href={`/painel/compras/${detail.purchaseId}/consulta-pagamento`}
              >
                Consultar pagamento (Cielo)
              </Link>
            </li>
            <li>
              <Link className="text-[#1d68a2] underline" href="#contestacoes">
                Contestações Cielo
              </Link>
            </li></>}
          </ul>
          {userProfileHref && <Link className="mt-4 inline-flex min-h-11 items-center text-[#1d68a2] underline" href={userProfileHref}>Mais detalhes do cliente</Link>}
        </div>
        {canOperateVouchers && detail.operational?.vouchers.every(v => v.schoolId === null) &&
          <PainelPurchaseBatch purchaseIds={[detail.purchaseId]} onComplete={() => setSelection([])} />}
      </aside>
    </section>
  );
}
