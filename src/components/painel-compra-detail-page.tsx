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

  return (
    <section className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
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

        <h1 className="mt-6 text-[28px] font-semibold text-[#205a7f]">
          Dados Compra / Reserva
        </h1>

        <div className="mt-4 overflow-x-auto border border-[#cfcfcf]">
          <table className="min-w-full border-collapse text-[15px]">
            <tbody>
              <tr className="bg-[#5f84a3] text-left text-white">
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal" colSpan={2}>
                  Compra feita em
                </th>
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Tipo</th>
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Status</th>
              </tr>
              <tr>
                <td className="border border-[#d7d7d7] px-4 py-3" colSpan={2}>
                  {detail.purchaseDate ?? "-"}
                </td>
                <td className="border border-[#d7d7d7] px-4 py-3">{detail.typeLabel}</td>
                <td className="border border-[#d7d7d7] px-4 py-3">
                  <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${detail.status === "conc" ? "bg-[#e2f4e8] text-[#24733c]" : detail.status === "pend" ? "bg-[#fff3cd] text-[#8a6500]" : detail.status === "canc" ? "bg-[#fbe4e4] text-[#a83232]" : "bg-[#eef2f5] text-[#526779]"}`}>
                    {detail.statusLabel}
                  </span>
                </td>
              </tr>
              <tr className="bg-[#5f84a3] text-left text-white">
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Pagamento</th>
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Forma Pag.</th>
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Data de pagamento</th>
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Hora de pagamento</th>
              </tr>
              <tr>
                <td className="border border-[#d7d7d7] px-4 py-3">{detail.paymentLabel}</td>
                <td className="border border-[#d7d7d7] px-4 py-3">{detail.paymentMethodLabel}</td>
                <td className="border border-[#d7d7d7] px-4 py-3">{detail.paymentDate ?? "-"}</td>
                <td className="border border-[#d7d7d7] px-4 py-3">{detail.paymentTime ?? "-"}</td>
              </tr>
              {detail.referralCode ? (
                <>
                  <tr className="bg-[#5f84a3] text-left text-white">
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Valor</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                      Código de indicação
                    </th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">CPF</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Usuário</th>
                  </tr>
                  <tr>
                    <td className="border border-[#d7d7d7] px-4 py-3">{detail.totalValue}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{detail.referralCode}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{formatCpf(detail.cpf)}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">
                      {detail.userName && userProfileHref ? (
                        <Link className="text-[#1868d6] underline" href={userProfileHref}>
                          {detail.userName}
                        </Link>
                      ) : (
                        detail.userName ?? "-"
                      )}
                    </td>
                  </tr>
                </>
              ) : (
                <>
                  <tr className="bg-[#5f84a3] text-left text-white">
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal" colSpan={2}>
                      Valor
                    </th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">CPF</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Usuário</th>
                  </tr>
                  <tr>
                    <td className="border border-[#d7d7d7] px-4 py-3" colSpan={2}>
                      {detail.totalValue}
                    </td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{formatCpf(detail.cpf)}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">
                      {detail.userName && userProfileHref ? (
                        <Link className="text-[#1868d6] underline" href={userProfileHref}>
                          {detail.userName}
                        </Link>
                      ) : (
                        detail.userName ?? "-"
                      )}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {detail.gatewayPaymentId ? (
          <>
            <h2 className="mt-8 text-[28px] font-semibold text-[#205a7f]">Pagamento</h2>
            <div className="mt-4 overflow-x-auto border border-[#cfcfcf]">
              <table className="min-w-full border-collapse text-[15px]">
                <thead className="bg-[#5f84a3] text-left text-white">
                  <tr>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                      ID Pagamento
                    </th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Status</th>
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
              <thead className="bg-[#5f84a3] text-left text-white">
                <tr>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal"><input type="checkbox" aria-label="Selecionar todos os vouchers" disabled={actionsBusy} checked={detail.vouchers.length > 0 && selectedIds.length === detail.vouchers.length} onChange={(event) => setSelection(event.target.checked ? detail.vouchers.map((voucher) => voucher.voucherId) : [])} /></th>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">ID</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Voucher</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Data da visita</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Validade</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Tipo</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Aluno</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Escola</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Turma</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Valor</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Usado?</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Data de uso</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Hora de uso</th>
                </tr>
              </thead>
              <tbody>
                {detail.vouchers.map((voucher, index) => (
                  <tr
                    className={voucher.used === "s" ? "bg-[#eeeeee] text-[#68727b]" : index % 2 === 1 ? "bg-[#fafafa]" : "bg-white"}
                    key={voucher.voucherId}
                  >
                    <td className="border border-[#d7d7d7] px-4 py-3"><input type="checkbox" aria-label={`Selecionar voucher ${voucher.voucherNumber ?? voucher.voucherId}`} disabled={actionsBusy} checked={selectedIds.includes(voucher.voucherId)} onChange={(event) => setSelection(event.target.checked ? [...selectedIds, voucher.voucherId] : selectedIds.filter((id) => id !== voucher.voucherId))} /></td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{voucher.voucherId}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">
                      <span className="inline-block min-w-[120px] bg-[#eaeaea] px-3 py-1 text-center font-mono text-sm">
                        {voucher.voucherNumber ?? "-"}
                      </span>
                    </td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{operationalVouchers.has(voucher.voucherId) ? civilDate(operationalVouchers.get(voucher.voucherId)?.visitDate) : voucher.visitDate ?? "-"}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{operationalVouchers.get(voucher.voucherId)?.validFrom ? `${civilDate(operationalVouchers.get(voucher.voucherId)?.validFrom)} até ${civilDate(operationalVouchers.get(voucher.voucherId)?.validUntil)}` : operationalVouchers.get(voucher.voucherId)?.validUntil ? `Até ${civilDate(operationalVouchers.get(voucher.voucherId)?.validUntil)} · legado` : "Não registrada"}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{voucher.voucherTypeLabel}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{voucher.studentName ?? "-"}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">
                      {canAccessSchool && voucher.schoolName && voucher.schoolTripHref ? (
                        <Link className="text-[#1868d6] underline" href={voucher.schoolTripHref}>
                          {voucher.schoolName}
                        </Link>
                      ) : (
                        voucher.schoolName ?? "-"
                      )}
                    </td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{voucher.className ?? "-"}</td>
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
                    </td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{voucher.usedDate ?? "-"}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{voucher.usedTime ?? "-"}{voucher.used === "s" && <div className="mt-2 space-y-1 text-xs"><p>{operationalVouchers.get(voucher.voucherId)?.validation?.locationName ?? "Local não registrado"}</p><p>{operationalVouchers.get(voucher.voucherId)?.validation?.actorName ?? "Operador não registrado"}</p></div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <section className="mt-8 space-y-4" aria-labelledby="purchase-receipts-title">
          <h2 id="purchase-receipts-title" className="text-xl font-semibold text-[#205a7f]">Recebimentos registrados</h2>
          {!detail.operational ? <p>Dados operacionais indisponíveis.</p> : detail.operational.payments.length === 0 ? <p>Nenhum recebimento individual registrado nesta fonte. Consulte também os dados de pagamento acima.</p> : <ul className="divide-y divide-[#d7d7d7]">{detail.operational.payments.map((payment) => <li key={payment.id} className="flex flex-wrap justify-between gap-3 py-3"><div><p>{paymentMethods[payment.method] ?? payment.method}</p><p className="text-sm text-[#5d7282]">{payment.receivedAt ? timestamp(payment.receivedAt) : "Data do recebimento não registrada"}{payment.periodId !== null && ` · Caixa #${payment.periodId}`}</p></div><strong>{money(payment.amountCents)}</strong></li>)}</ul>}
        </section>
        <section className="mt-8 space-y-4" aria-labelledby="purchase-history-title">
          <h2 id="purchase-history-title" className="text-xl font-semibold text-[#205a7f]">Histórico da compra</h2>
          {!detail.operational ? <p>Histórico indisponível.</p> : detail.operational.history.length === 0 ? <p>Nenhuma alteração registrada.</p> : <ol className="divide-y divide-[#d7d7d7]">{detail.operational.history.map((event) => <li key={event.id} className="space-y-1 py-3"><p className="font-semibold">{event.description}</p><p>{event.reason}</p><p className="text-sm text-[#5d7282]">{timestamp(event.occurredAt)} · {event.actorName ?? "Operador não informado"}</p></li>)}</ol>}
        </section>
        <div className="mt-6">
          <PainelCompraContestacoes key={detail.purchaseId} purchaseId={detail.purchaseId} />
        </div>
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
            <li>
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
            </li>
          </ul>
          {userProfileHref && <Link className="mt-4 inline-flex min-h-11 items-center text-[#1d68a2] underline" href={userProfileHref}>Mais detalhes do cliente</Link>}
        </div>
        <PainelCompraDetailActions
          purchaseId={detail.purchaseId}
          voucherIds={selectedIds}
          canOperate={canOperateVouchers}
          onBusyChange={setActionsBusy}
          onOperationComplete={() => setSelection([])}
        />
        {canOperateVouchers && detail.operational.vouchers.every(v => v.schoolId === null) &&
          <PainelPurchaseBatch purchaseIds={[detail.purchaseId]} onComplete={() => setSelection([])} />}
      </aside>
    </section>
  );
}
