"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  formatPainelBilheteriaCpf as formatCpf,
  formatPainelBilheteriaDate as formatDate,
  formatPainelBilheteriaMoney as formatMoney,
} from "@/lib/painel-bilheteria-format";
import type {
  PainelBilheteriaPaymentMethodOption,
  PainelBilheteriaPurchaseDetail,
} from "@/lib/painel-bilheteria";

type PaymentDraft = {
  method: string;
  value: string;
};

type GatewayStatusState = {
  purchaseId: number;
  configured: boolean;
  paymentId: string | null;
  reference: string | null;
  ledgerStatus: number | null;
  ledgerStatusLabel: string;
  ledgerUpdatedAt: string | null;
  consultResult: "ok" | "not_found" | "not_configured" | "no_transaction";
  gatewayStatus: number | null;
  gatewayStatusLabel: string;
  purchaseStatus: "conc" | "pend" | "canc" | "unknown" | null;
  message: string;
};

type PainelBilheteriaPurchaseDetailProps = {
  detail: PainelBilheteriaPurchaseDetail;
  actorName: string | null;
  actorCpf: string | null;
  returnHref: string;
  editHref?: string | null;
  mode: "history" | "reservation";
  canManageHistory: boolean;
  paymentOptions: PainelBilheteriaPaymentMethodOption[];
  flashSuccess?: string | null;
  flashWarnings?: string[];
};

function getDefaultPayments(
  detail: PainelBilheteriaPurchaseDetail,
  paymentOptions: PainelBilheteriaPaymentMethodOption[],
) {
  const defaultMethod = paymentOptions[0]?.value ?? "dinhe";

  return [
    {
      method: defaultMethod,
      value: detail.totalValue,
    },
  ] satisfies PaymentDraft[];
}

function parseMoneyInput(value: string) {
  const trimmed = value.trim().replace(/^R\$\s*/i, "");

  if (!trimmed) {
    return 0;
  }

  const normalized =
    trimmed.includes(",") && trimmed.includes(".")
      ? trimmed.replace(/\./g, "").replace(",", ".")
      : trimmed.includes(",")
        ? trimmed.replace(",", ".")
        : trimmed;
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

async function readErrorPayload(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as {
      error?: {
        message?: string;
      };
    };

    return payload.error?.message || fallback;
  } catch {
    return fallback;
  }
}

export function PainelBilheteriaPurchaseDetail({
  detail,
  actorName,
  actorCpf,
  returnHref,
  editHref = null,
  mode,
  canManageHistory,
  paymentOptions,
  flashSuccess = null,
  flashWarnings = [],
}: PainelBilheteriaPurchaseDetailProps) {
  const router = useRouter();
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentDraft[]>(() =>
    getDefaultPayments(detail, paymentOptions),
  );
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatusState | null>(null);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [consultingGateway, setConsultingGateway] = useState(false);
  const [whatsappVoucherId, setWhatsappVoucherId] = useState(
    detail.vouchers[0]?.voucherId ? String(detail.vouchers[0].voucherId) : "",
  );
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [whatsappSuccess, setWhatsappSuccess] = useState<string | null>(null);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const paymentTotal = useMemo(
    () =>
      payments.reduce((sum, payment) => sum + parseMoneyInput(payment.value), 0),
    [payments],
  );

  function updatePayment(index: number, patch: Partial<PaymentDraft>) {
    setPayments((current) =>
      current.map((payment, currentIndex) =>
        currentIndex === index ? { ...payment, ...patch } : payment,
      ),
    );
  }

  function addPaymentRow() {
    setPayments((current) => [
      ...current,
      {
        method: paymentOptions[0]?.value ?? "dinhe",
        value: "",
      },
    ]);
  }

  function removePaymentRow(index: number) {
    setPayments((current) =>
      current.length === 1
        ? current
        : current.filter((_, currentIndex) => currentIndex !== index),
    );
  }

  async function handleCancel() {
    const reason = cancelReason.trim();

    if (!reason) {
      setCancelError("Informe o motivo da exclusao.");
      setCancelSuccess(null);
      return;
    }

    setCancelling(true);
    setCancelError(null);
    setCancelSuccess(null);

    try {
      const response = await fetch("/api/painel/bilheteria/purchases/cancel", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          purchaseId: detail.purchaseId,
          reason,
          actor: {
            name: actorName,
            cpf: actorCpf,
          },
        }),
      });

      if (!response.ok) {
        setCancelError(
          await readErrorPayload(
            response,
            "Nao foi possivel cancelar a compra agora.",
          ),
        );
        return;
      }

      setCancelSuccess("Compra cancelada com sucesso.");
      setConfirmCancelOpen(false);
      router.refresh();
    } finally {
      setCancelling(false);
    }
  }

  async function handlePayReservation() {
    setPaymentError(null);
    setPaymentSuccess(null);
    setSubmittingPayment(true);

    try {
      const response = await fetch(
        `/api/painel/bilheteria/reservations/${detail.purchaseId}/pay`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            payments,
            actor: {
              name: actorName,
              cpf: actorCpf,
            },
          }),
        },
      );

      if (!response.ok) {
        setPaymentError(
          await readErrorPayload(
            response,
            "Nao foi possivel registrar o pagamento da reserva.",
          ),
        );
        return;
      }

      const payload = (await response.json()) as {
        data?: {
          message?: string;
          alreadyPaid?: boolean;
        };
      };

      setPaymentSuccess(
        payload.data?.message ||
          (payload.data?.alreadyPaid
            ? "Reserva ja estava paga."
            : "Pagamento registrado com sucesso."),
      );
      router.refresh();
    } finally {
      setSubmittingPayment(false);
    }
  }

  async function handleConsultGateway() {
    setConsultingGateway(true);
    setGatewayError(null);

    try {
      const response = await fetch(
        `/api/painel/bilheteria/purchases/${detail.purchaseId}/gateway-status`,
        {
          method: "GET",
        },
      );

      if (!response.ok) {
        setGatewayError(
          await readErrorPayload(
            response,
            "Nao foi possivel consultar o gateway agora.",
          ),
        );
        return;
      }

      const payload = (await response.json()) as {
        data?: GatewayStatusState;
      };

      setGatewayStatus(payload.data ?? null);
    } finally {
      setConsultingGateway(false);
    }
  }

  async function handleSendWhatsapp() {
    setWhatsappError(null);
    setWhatsappSuccess(null);
    setSendingWhatsapp(true);

    try {
      const voucherId = Number(whatsappVoucherId);
      const response = await fetch(
        `/api/painel/bilheteria/vouchers/${voucherId}/whatsapp`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            purchaseId: detail.purchaseId,
            phoneNumber: whatsappPhone,
            actor: {
              name: actorName,
              cpf: actorCpf,
            },
          }),
        },
      );

      if (!response.ok) {
        setWhatsappError(
          await readErrorPayload(
            response,
            "Nao foi possivel enviar o voucher por WhatsApp agora.",
          ),
        );
        return;
      }

      const payload = (await response.json()) as {
        data?: {
          validUntil?: string;
          message?: string;
        };
      };

      setWhatsappSuccess(
        payload.data?.validUntil
          ? `${payload.data?.message || "Solicitacao enviada para o WhatsApp."} Validade atualizada para ${payload.data.validUntil}.`
          : payload.data?.message || "Solicitacao enviada para o WhatsApp.",
      );
      setWhatsappModalOpen(false);
      router.refresh();
    } finally {
      setSendingWhatsapp(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_420px]">
      <section className="rounded-[28px] border border-[#d7e5ef] bg-white p-6 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#5d7282]">
              Compra #{detail.purchaseId}
            </p>
            <h2 className="legacy-condensed mt-2 text-4xl text-[#205a7f]">
              {detail.typeLabel}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#5d7282]">
              CPF {formatCpf(detail.cpf)} • {detail.statusLabel}
            </p>
          </div>

          <a
            href={returnHref}
            className="rounded-full border border-[#c9d8e3] px-4 py-2 text-sm font-semibold text-[#205a7f] hover:bg-[#edf5fa]"
          >
            Voltar
          </a>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[22px] border border-[#d9e3eb] bg-[#f7fafc] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#5d7282]">
              Total
            </div>
            <div className="mt-3 text-2xl font-semibold text-[#205a7f]">
              {formatMoney(detail.totalValue)}
            </div>
          </div>
          <div className="rounded-[22px] border border-[#d9e3eb] bg-[#f7fafc] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#5d7282]">
              Compra
            </div>
            <div className="mt-3 text-sm font-semibold text-[#205a7f]">
              {formatDate(detail.purchaseDate)}
            </div>
          </div>
          <div className="rounded-[22px] border border-[#d9e3eb] bg-[#f7fafc] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#5d7282]">
              Pagamento
            </div>
            <div className="mt-3 text-sm font-semibold text-[#205a7f]">
              {detail.paymentMethodLabel || "-"}
            </div>
          </div>
          <div className="rounded-[22px] border border-[#d9e3eb] bg-[#f7fafc] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#5d7282]">
              Pago em
            </div>
            <div className="mt-3 text-sm font-semibold text-[#205a7f]">
              {detail.paidAt ? detail.paidAt.replace(" ", " as ") : "-"}
            </div>
          </div>
        </div>

        {flashSuccess ? (
          <div className="mt-6 rounded-[18px] border border-[#b9dec6] bg-[#eefaf2] px-4 py-3 text-sm text-[#286445]">
            {flashSuccess}
          </div>
        ) : null}
        {flashWarnings.length > 0 ? (
          <div className="mt-4 rounded-[18px] border border-[#f0d3a8] bg-[#fff6e3] px-4 py-3 text-sm text-[#8a6100]">
            <p className="font-semibold">Avisos apos salvar</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {flashWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-6 grid gap-6">
          <section className="rounded-[24px] border border-[#d9e3eb] bg-[#fbfdff] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#5d7282]">
                  Passaportes
                </p>
                <h3 className="mt-2 text-xl font-semibold text-[#205a7f]">
                  Itens vinculados
                </h3>
              </div>
              <div className="text-sm text-[#5d7282]">
                {detail.vouchers.length} item(ns)
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 overflow-hidden rounded-[20px] border border-[#d9e3eb] text-sm">
                <thead className="bg-[#edf5fa] text-left text-[#345062]">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Voucher</th>
                    <th className="px-4 py-3">Data da visita</th>
                    <th className="px-4 py-3">Passaporte</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Acao</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.vouchers.map((voucher) => (
                    <tr key={voucher.voucherId} className="border-t border-[#e4edf4] bg-white">
                      <td className="px-4 py-3">{voucher.voucherId}</td>
                      <td className="px-4 py-3">{voucher.voucherNumber || voucher.voucherId}</td>
                      <td className="px-4 py-3">{formatDate(voucher.visitDate)}</td>
                      <td className="px-4 py-3">{voucher.voucherTypeLabel}</td>
                      <td className="px-4 py-3 text-right">{formatMoney(voucher.unitValue)}</td>
                      <td className="px-4 py-3">{voucher.statusLabel}</td>
                      <td className="px-4 py-3 text-right">
                        {voucher.status === "s" ? (
                          <span className="text-xs font-semibold text-[#9f3d2f]">
                            Ja usado
                          </span>
                        ) : (
                          <a
                            href={`/painel/bilheteria/vouchers/${voucher.voucherId}/imprimir`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex rounded-full border border-[#c9d8e3] px-3 py-2 text-xs font-semibold text-[#205a7f] hover:bg-[#edf5fa]"
                          >
                            Imprimir QR
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-[24px] border border-[#d9e3eb] bg-[#fbfdff] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#5d7282]">
              Pagamentos
            </p>
            <h3 className="mt-2 text-xl font-semibold text-[#205a7f]">
              Formas de pagamento
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#5d7282]">
              Distribuicao do valor da venda entre as formas registradas.
            </p>

            {detail.payments.length === 0 ? (
              <div className="mt-4 rounded-[20px] border border-dashed border-[#c9d8e3] bg-white px-4 py-5 text-sm text-[#5d7282]">
                Nenhum pagamento operacional registrado.
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 overflow-hidden rounded-[20px] border border-[#d9e3eb] text-sm">
                  <thead className="bg-[#edf5fa] text-left text-[#345062]">
                    <tr>
                      <th className="px-4 py-3">Forma</th>
                      <th className="px-4 py-3 text-right">Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.payments.map((payment, index) => (
                      <tr
                        key={`${payment.method}-${index}`}
                        className="border-t border-[#e4edf4] bg-white"
                      >
                        <td className="px-4 py-3 font-semibold text-[#205a7f]">
                          {payment.methodLabel}
                        </td>
                        <td className="px-4 py-3 text-right text-[#345062]">
                          {formatMoney(payment.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </section>

      <div className="grid gap-6">
        {mode === "reservation" && detail.payableReservation ? (
          <section className="rounded-[28px] border border-[#d7e5ef] bg-white p-6 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#5d7282]">
              Pagamento da reserva
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-[#205a7f]">Pagamento</h3>
            <p className="mt-3 text-sm leading-6 text-[#5d7282]">
              Distribua o valor da reserva entre as formas informadas.
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={addPaymentRow}
                className="rounded-full border border-[#c9d8e3] px-4 py-2 text-sm font-semibold text-[#205a7f] hover:bg-[#edf5fa]"
              >
                + outra forma
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 overflow-hidden rounded-[20px] border border-[#d9e3eb] text-sm">
                <thead className="bg-[#edf5fa] text-left text-[#345062]">
                  <tr>
                    <th className="px-4 py-3">Forma</th>
                    <th className="px-4 py-3">Valor (R$)</th>
                    <th className="w-[96px] px-4 py-3 text-right">Acao</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment, index) => (
                    <tr
                      key={`payment-row-${index}`}
                      className="border-t border-[#e4edf4] bg-white"
                    >
                      <td className="px-4 py-3">
                        <select
                          value={payment.method}
                          onChange={(event) =>
                            updatePayment(index, { method: event.target.value })
                          }
                          className="w-full rounded-[14px] border border-[#c9d8e3] bg-white px-3 py-2 text-sm text-[#1b3447]"
                        >
                          {paymentOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={payment.value}
                          onChange={(event) =>
                            updatePayment(index, { value: event.target.value })
                          }
                          placeholder="0,00"
                          className="w-full rounded-[14px] border border-[#c9d8e3] bg-white px-3 py-2 text-sm text-[#1b3447]"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {payments.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removePaymentRow(index)}
                            className="rounded-full border border-[#d0dde7] px-3 py-2 text-xs font-semibold text-[#205a7f]"
                          >
                            Remover
                          </button>
                        ) : (
                          <span className="text-xs text-[#8aa0b1]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-sm leading-7 text-[#345062]">
              Total informado: <strong className="text-[#205a7f]">{formatMoney(paymentTotal)}</strong>
              <br />
              Total da compra: <strong className="text-[#205a7f]">{formatMoney(detail.totalValue)}</strong>
            </div>

            {paymentError ? (
              <div className="mt-4 rounded-[18px] border border-[#f0bbb1] bg-[#fff2ef] px-4 py-3 text-sm text-[#9f3d2f]">
                {paymentError}
              </div>
            ) : null}
            {paymentSuccess ? (
              <div className="mt-4 rounded-[18px] border border-[#b9dec6] bg-[#eefaf2] px-4 py-3 text-sm text-[#286445]">
                {paymentSuccess}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void handlePayReservation()}
              disabled={submittingPayment}
              className="mt-5 w-full rounded-full bg-[#246b99] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submittingPayment ? "Confirmando..." : "Confirmar Pagamento"}
            </button>
          </section>
        ) : null}

        {mode === "reservation" &&
        !detail.payableReservation &&
        detail.vouchers.length > 0 ? (
          <section className="rounded-[28px] border border-[#d7e5ef] bg-white p-6 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#5d7282]">
              Pagamento
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-[#205a7f]">
              Pagamento Concluido
            </h3>
            <p className="mt-3 text-sm leading-6 text-[#5d7282]">
              Use as acoes abaixo para concluir o atendimento desta reserva.
            </p>

            <div className="mt-5 grid gap-3">
              <a
                href={`/painel/bilheteria/compras/${detail.purchaseId}/imprimir`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center rounded-full bg-[#246b99] px-5 py-3 text-sm font-semibold text-white"
              >
                Imprimir QR-Codes
              </a>
              <button
                type="button"
                onClick={() => setWhatsappModalOpen(true)}
                className="inline-flex w-full items-center justify-center rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-white"
              >
                Enviar por WhatsApp
              </button>
              <a
                href="/painel/bilheteria"
                className="inline-flex w-full items-center justify-center rounded-full bg-[#aaaaaa] px-5 py-3 text-sm font-semibold text-white"
              >
                Voltar
              </a>
            </div>

            {whatsappSuccess ? (
              <div className="mt-4 rounded-[18px] border border-[#b9dec6] bg-[#eefaf2] px-4 py-3 text-sm text-[#286445]">
                {whatsappSuccess}
              </div>
            ) : null}
          </section>
        ) : null}

        {canManageHistory && detail.status !== "canc" ? (
          <section className="rounded-[28px] border border-[#d7e5ef] bg-white p-6 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#5d7282]">
              Historico
            </p>
            <a
              href={editHref || `/painel/bilheteria/historico/${detail.purchaseId}/editar`}
              className="mt-4 inline-flex rounded-full border border-[#c9d8e3] px-4 py-2 text-sm font-semibold text-[#205a7f] hover:bg-[#edf5fa]"
            >
              Editar venda
            </a>
            <h3 className="mt-2 text-2xl font-semibold text-[#205a7f]">
              Cancelar compra
            </h3>
            <p className="mt-3 text-sm leading-6 text-[#5d7282]">
              Use apenas quando o fluxo exigir invalidação auditável da venda.
            </p>

            <label className="mt-5 grid gap-2 text-sm font-semibold text-[#345062]">
              Explique o motivo da exclusao
              <textarea
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                rows={3}
                className="rounded-[18px] border border-[#c9d8e3] bg-white px-4 py-3 text-sm text-[#1b3447]"
                placeholder="Descreva o motivo da exclusao"
              />
            </label>

            {cancelError ? (
              <div className="mt-4 rounded-[18px] border border-[#f0bbb1] bg-[#fff2ef] px-4 py-3 text-sm text-[#9f3d2f]">
                {cancelError}
              </div>
            ) : null}
            {cancelSuccess ? (
              <div className="mt-4 rounded-[18px] border border-[#b9dec6] bg-[#eefaf2] px-4 py-3 text-sm text-[#286445]">
                {cancelSuccess}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setConfirmCancelOpen(true)}
              disabled={cancelling}
              className="mt-5 w-full rounded-full bg-[#9f3d2f] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {cancelling ? "Cancelando..." : "Cancelar compra"}
            </button>
          </section>
        ) : null}

        <section className="rounded-[28px] border border-[#d7e5ef] bg-white p-6 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#5d7282]">
            Gateway
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-[#205a7f]">
            Consulta manual
          </h3>
          <p className="mt-3 text-sm leading-6 text-[#5d7282]">
            Consulte o ultimo status do gateway sem alterar a compra.
          </p>

          <button
            type="button"
            onClick={() => void handleConsultGateway()}
            disabled={consultingGateway}
            className="mt-5 w-full rounded-full border border-[#c9d8e3] px-5 py-3 text-sm font-semibold text-[#205a7f] hover:bg-[#edf5fa] disabled:opacity-60"
          >
            {consultingGateway ? "Consultando..." : "Consultar gateway"}
          </button>

          {gatewayError ? (
            <div className="mt-4 rounded-[18px] border border-[#f0bbb1] bg-[#fff2ef] px-4 py-3 text-sm text-[#9f3d2f]">
              {gatewayError}
            </div>
          ) : null}

          {gatewayStatus ? (
            <div className="mt-4 grid gap-3 rounded-[22px] border border-[#d9e3eb] bg-[#f8fbfd] p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-[#205a7f]">Resultado</span>
                <span className="rounded-full border border-[#c9d8e3] px-3 py-1 text-xs font-semibold text-[#205a7f]">
                  {gatewayStatus.consultResult}
                </span>
              </div>
              <div className="grid gap-2 text-[#345062]">
                <div>
                  <span className="font-semibold text-[#205a7f]">Mensagem:</span>{" "}
                  {gatewayStatus.message}
                </div>
                <div>
                  <span className="font-semibold text-[#205a7f]">Payment ID:</span>{" "}
                  {gatewayStatus.paymentId || "-"}
                </div>
                <div>
                  <span className="font-semibold text-[#205a7f]">Referencia:</span>{" "}
                  {gatewayStatus.reference || "-"}
                </div>
                <div>
                  <span className="font-semibold text-[#205a7f]">Status ledger:</span>{" "}
                  {gatewayStatus.ledgerStatusLabel}
                </div>
                <div>
                  <span className="font-semibold text-[#205a7f]">Status gateway:</span>{" "}
                  {gatewayStatus.gatewayStatusLabel}
                </div>
                <div>
                  <span className="font-semibold text-[#205a7f]">Compra resultante:</span>{" "}
                  {gatewayStatus.purchaseStatus || "-"}
                </div>
                <div>
                  <span className="font-semibold text-[#205a7f]">Ultima atualizacao:</span>{" "}
                  {gatewayStatus.ledgerUpdatedAt ? gatewayStatus.ledgerUpdatedAt.replace("T", " ").slice(0, 19) : "-"}
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {!(mode === "reservation" && !detail.payableReservation) ? (
        <section className="rounded-[28px] border border-[#d7e5ef] bg-white p-6 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#5d7282]">
            WhatsApp
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-[#205a7f]">
            Envio operacional
          </h3>
          <p className="mt-3 text-sm leading-6 text-[#5d7282]">
            Reenvie um voucher especifico por telefone, como no painel legado.
          </p>

          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-semibold text-[#345062]">
              Voucher
              <select
                value={whatsappVoucherId}
                onChange={(event) => setWhatsappVoucherId(event.target.value)}
                className="rounded-[16px] border border-[#c9d8e3] bg-white px-4 py-3 text-sm text-[#1b3447]"
              >
                {detail.vouchers.map((voucher) => (
                  <option key={voucher.voucherId} value={String(voucher.voucherId)}>
                    {voucher.voucherNumber || voucher.voucherId} · {voucher.voucherTypeLabel}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-semibold text-[#345062]">
              Telefone
              <input
                value={whatsappPhone}
                onChange={(event) => setWhatsappPhone(event.target.value)}
                placeholder="(11) 99999-9999"
                className="rounded-[16px] border border-[#c9d8e3] bg-white px-4 py-3 text-sm text-[#1b3447]"
              />
            </label>
          </div>

          {whatsappError ? (
            <div className="mt-4 rounded-[18px] border border-[#f0bbb1] bg-[#fff2ef] px-4 py-3 text-sm text-[#9f3d2f]">
              {whatsappError}
            </div>
          ) : null}

          {whatsappSuccess ? (
            <div className="mt-4 rounded-[18px] border border-[#b9dec6] bg-[#eefaf2] px-4 py-3 text-sm text-[#286445]">
              {whatsappSuccess}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void handleSendWhatsapp()}
            disabled={sendingWhatsapp || !whatsappVoucherId}
            className="mt-5 w-full rounded-full border border-[#c9d8e3] px-5 py-3 text-sm font-semibold text-[#205a7f] hover:bg-[#edf5fa] disabled:opacity-60"
          >
            {sendingWhatsapp ? "Enviando..." : "Enviar por WhatsApp"}
          </button>
        </section>
        ) : null}
      </div>

      {confirmCancelOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,34,53,0.48)] px-6">
          <div className="w-full max-w-[560px] rounded-[28px] border border-[#d7e5ef] bg-white p-6 shadow-[0_26px_70px_rgba(16,45,70,0.22)]">
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-2xl font-semibold text-[#205a7f]">Cancelar compra</h3>
              <button
                type="button"
                onClick={() => setConfirmCancelOpen(false)}
                className="h-10 w-10 rounded-full border border-[#c9d8e3] text-xl font-semibold text-[#205a7f]"
              >
                &times;
              </button>
            </div>

            <div className="mt-4 space-y-2 text-sm leading-7 text-[#5d7282]">
              <div>
                <strong className="text-[#205a7f]">Data:</strong> {formatDate(detail.purchaseDate)}
              </div>
              <div>
                <strong className="text-[#205a7f]">ID:</strong> {detail.purchaseId}
              </div>
              <div>
                <strong className="text-[#205a7f]">CPF:</strong> {formatCpf(detail.cpf)}
              </div>
              <div>
                <strong className="text-[#205a7f]">Valor:</strong> {formatMoney(detail.totalValue)}
              </div>
            </div>

            <label className="mt-4 grid gap-2 text-sm font-semibold text-[#345062]">
              Explique o motivo da exclusao
              <textarea
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                rows={3}
                className="rounded-[18px] border border-[#c9d8e3] bg-white px-4 py-3 text-sm text-[#1b3447]"
                placeholder="Descreva o motivo da exclusao"
              />
            </label>

            <p className="mt-4 text-sm leading-7 text-[#5d7282]">
              Deseja cancelar essa compra?
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmCancelOpen(false)}
                className="rounded-full border border-[#c9d8e3] px-5 py-3 text-sm font-semibold text-[#205a7f]"
              >
                Nao
              </button>
              <button
                type="button"
                onClick={() => void handleCancel()}
                disabled={cancelling}
                className="rounded-full bg-[#9f3d2f] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {cancelling ? "Cancelando..." : "Sim, cancelar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {whatsappModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,34,53,0.48)] px-6">
          <div className="w-full max-w-[420px] rounded-[28px] border border-[#d7e5ef] bg-white p-6 shadow-[0_26px_70px_rgba(16,45,70,0.22)]">
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-2xl font-semibold text-[#205a7f]">
                Enviar por WhatsApp
              </h3>
              <button
                type="button"
                onClick={() => setWhatsappModalOpen(false)}
                className="h-10 w-10 rounded-full border border-[#c9d8e3] text-xl font-semibold text-[#205a7f]"
              >
                &times;
              </button>
            </div>

            <div className="mt-4 grid gap-4">
              <label className="grid gap-2 text-sm font-semibold text-[#345062]">
                Voucher
                <select
                  value={whatsappVoucherId}
                  onChange={(event) => setWhatsappVoucherId(event.target.value)}
                  className="rounded-[16px] border border-[#c9d8e3] bg-white px-4 py-3 text-sm text-[#1b3447]"
                >
                  {detail.vouchers.map((voucher) => (
                    <option key={voucher.voucherId} value={String(voucher.voucherId)}>
                      {voucher.voucherNumber || voucher.voucherId} · {voucher.voucherTypeLabel}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-semibold text-[#345062]">
                Telefone com DDD
                <input
                  value={whatsappPhone}
                  onChange={(event) => setWhatsappPhone(event.target.value)}
                  placeholder="(11) 99999-9999"
                  className="rounded-[16px] border border-[#c9d8e3] bg-white px-4 py-3 text-sm text-[#1b3447]"
                />
              </label>
            </div>

            {whatsappError ? (
              <div className="mt-4 rounded-[18px] border border-[#f0bbb1] bg-[#fff2ef] px-4 py-3 text-sm text-[#9f3d2f]">
                {whatsappError}
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setWhatsappModalOpen(false)}
                className="rounded-full border border-[#c9d8e3] px-5 py-3 text-sm font-semibold text-[#205a7f]"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => void handleSendWhatsapp()}
                disabled={sendingWhatsapp || !whatsappVoucherId}
                className="rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {sendingWhatsapp ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
