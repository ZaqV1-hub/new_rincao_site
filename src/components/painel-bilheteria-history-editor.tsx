"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatPainelBilheteriaMoney as formatMoney } from "@/lib/painel-bilheteria-format";
import type {
  PainelBilheteriaPaymentMethodOption,
  PainelBilheteriaPurchaseDetail,
} from "@/lib/painel-bilheteria";

type PaymentDraft = {
  method: string;
  value: string;
};

type VoucherDraft = {
  id: number;
  number: string | null;
  typeLabel: string;
  baseTypeLabel: string;
  status: "n" | "s" | "inv";
  previousStatus: "n" | "s" | "inv";
  unitValue: string;
  baseUnitValue: string;
  discountId: string;
  discountEditable: boolean;
  description: string | null;
  visitDate: string | null;
  cancelled: boolean;
};

type PainelBilheteriaHistoryEditorProps = {
  detail: PainelBilheteriaPurchaseDetail;
  actorName: string | null;
  actorCpf: string | null;
  paymentOptions: PainelBilheteriaPaymentMethodOption[];
  returnHref?: string;
};

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

function getInitialPayments(
  detail: PainelBilheteriaPurchaseDetail,
  paymentOptions: PainelBilheteriaPaymentMethodOption[],
) {
  if (detail.payments.length > 0) {
    return detail.payments.map((payment) => ({
      method: payment.method,
      value: payment.value,
    }));
  }

  return [
    {
      method: detail.paymentMethod || paymentOptions[0]?.value || "dinhe",
      value: detail.totalValue,
    },
  ] satisfies PaymentDraft[];
}

function getInitialVouchers(detail: PainelBilheteriaPurchaseDetail) {
  return detail.vouchers.map(
    (voucher) =>
      ({
        id: voucher.voucherId,
        number: voucher.voucherNumber,
        typeLabel: voucher.voucherTypeLabel,
        baseTypeLabel: voucher.baseVoucherTypeLabel,
        status: voucher.status === "s" || voucher.status === "inv" ? voucher.status : "n",
        previousStatus:
          voucher.status === "s" || voucher.status === "inv" ? voucher.status : "n",
        unitValue: voucher.unitValue,
        baseUnitValue: voucher.baseUnitValue,
        discountId: voucher.discountId ? String(voucher.discountId) : "",
        discountEditable: voucher.discountEditable,
        description: voucher.description,
        visitDate: voucher.visitDate,
        cancelled: voucher.status === "inv",
      }) satisfies VoucherDraft,
  );
}

function getVoucherDisplayLabel(
  voucher: Pick<
    VoucherDraft,
    "baseTypeLabel" | "discountEditable" | "discountId" | "description"
  >,
  discountOptions: PainelBilheteriaPurchaseDetail["discountOptions"],
) {
  if (!voucher.discountEditable) {
    return voucher.description || voucher.baseTypeLabel;
  }

  const discount = discountOptions.find(
    (item) => String(item.id) === voucher.discountId.trim(),
  );

  return discount
    ? `${voucher.baseTypeLabel} - ${discount.name}`
    : `${voucher.baseTypeLabel} - Normal`;
}

async function readErrorPayload(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as {
      error?: {
        code?: string;
        message?: string;
      };
    };

    return {
      code: payload.error?.code || null,
      message: payload.error?.message || fallback,
    };
  } catch {
    return {
      code: null,
      message: fallback,
    };
  }
}

type ErrorTarget =
  | "purchaseDate"
  | "cpf"
  | "status"
  | "vouchers"
  | "payments"
  | "reason"
  | null;

function resolveErrorTarget(code: string | null): ErrorTarget {
  switch (code) {
    case "invalid_purchase_date":
      return "purchaseDate";
    case "invalid_cpf":
      return "cpf";
    case "invalid_purchase_status":
      return "status";
    case "invalid_discount_id":
    case "discount_not_found":
    case "invalid_voucher_value":
      return "vouchers";
    case "invalid_payments":
    case "invalid_payments_total":
      return "payments";
    case "invalid_update_reason":
      return "reason";
    default:
      return null;
  }
}

export function PainelBilheteriaHistoryEditor({
  detail,
  actorName,
  actorCpf,
  paymentOptions,
  returnHref = `/painel/bilheteria/historico/${detail.purchaseId}`,
}: PainelBilheteriaHistoryEditorProps) {
  const router = useRouter();
  const [purchaseDate, setPurchaseDate] = useState(detail.purchaseDate || "");
  const [cpf, setCpf] = useState(detail.cpf || "");
  const [status, setStatus] = useState<"conc" | "pend" | "canc">(
    detail.status === "pend" || detail.status === "canc" ? detail.status : "conc",
  );
  const [reason, setReason] = useState("");
  const [payments, setPayments] = useState<PaymentDraft[]>(() =>
    getInitialPayments(detail, paymentOptions),
  );
  const [vouchers, setVouchers] = useState<VoucherDraft[]>(() =>
    getInitialVouchers(detail),
  );
  const [error, setError] = useState<string | null>(null);
  const [errorTarget, setErrorTarget] = useState<ErrorTarget>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const voucherTotal = useMemo(
    () =>
      vouchers.reduce((sum, voucher) => {
        if (voucher.status === "inv") {
          return sum;
        }

        return sum + parseMoneyInput(voucher.unitValue);
      }, 0),
    [vouchers],
  );
  const paymentTotal = useMemo(
    () =>
      payments.reduce((sum, payment) => sum + parseMoneyInput(payment.value), 0),
    [payments],
  );
  const hasPaymentMismatch = Math.abs(paymentTotal - voucherTotal) > 0.01;
  const comparableState = useMemo(
    () =>
      JSON.stringify({
        purchaseDate,
        cpf,
        status,
        vouchers: vouchers
          .map((voucher) => ({
            id: voucher.id,
            status: voucher.status,
            discountId: voucher.discountId,
            unitValue: Number(parseMoneyInput(voucher.unitValue)).toFixed(2),
          }))
          .sort((left, right) => left.id - right.id),
        payments: payments
          .map((payment) => ({
            method: payment.method,
            value: Number(parseMoneyInput(payment.value)).toFixed(2),
          }))
          .sort((left, right) =>
            left.method === right.method
              ? left.value.localeCompare(right.value)
              : left.method.localeCompare(right.method),
          ),
      }),
    [cpf, payments, purchaseDate, status, vouchers],
  );
  const initialComparableState = useMemo(
    () =>
      JSON.stringify({
        purchaseDate: detail.purchaseDate || "",
        cpf: detail.cpf || "",
        status:
          detail.status === "pend" || detail.status === "canc"
            ? detail.status
            : "conc",
        vouchers: getInitialVouchers(detail)
          .map((voucher) => ({
            id: voucher.id,
            status: voucher.status,
            discountId: voucher.discountId,
            unitValue: Number(parseMoneyInput(voucher.unitValue)).toFixed(2),
          }))
          .sort((left, right) => left.id - right.id),
        payments: getInitialPayments(detail, paymentOptions)
          .map((payment) => ({
            method: payment.method,
            value: Number(parseMoneyInput(payment.value)).toFixed(2),
          }))
          .sort((left, right) =>
            left.method === right.method
              ? left.value.localeCompare(right.value)
              : left.method.localeCompare(right.method),
          ),
      }),
    [detail, paymentOptions],
  );
  const hasChanges = comparableState !== initialComparableState;

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

  function updateVoucher(index: number, patch: Partial<VoucherDraft>) {
    setVouchers((current) =>
      current.map((voucher, currentIndex) =>
        currentIndex === index ? { ...voucher, ...patch } : voucher,
      ),
    );
  }

  function toggleVoucherCancellation(index: number) {
    setVouchers((current) =>
      current.map((voucher, currentIndex) => {
        if (currentIndex !== index) {
          return voucher;
        }

        if (voucher.cancelled) {
          return {
            ...voucher,
            cancelled: false,
            status: voucher.previousStatus,
          };
        }

        return {
          ...voucher,
          cancelled: true,
          previousStatus: voucher.status,
          status: "inv",
        };
      }),
    );
  }

  function discountUnitPrice(basePrice: string, discountId: string) {
    const base = parseMoneyInput(basePrice);

    if (!discountId.trim()) {
      return base.toFixed(2);
    }

    const discount = detail.discountOptions.find(
      (item) => String(item.id) === discountId.trim(),
    );

    if (!discount) {
      return base.toFixed(2);
    }

    const discountValue = Number(discount.value ?? 0);
    let next = base;

    if (discount.applicationType === "percentual") {
      next = Math.max(0, base - base * discountValue / 100);
    } else if (discount.applicationType === "valor_fixo") {
      next = Math.max(0, base - discountValue);
    }

    return next.toFixed(2);
  }

  async function handleSubmit() {
    const trimmedReason = reason.trim();

    if (!hasChanges) {
      setConfirmSaveOpen(false);
      setError(null);
      setErrorTarget(null);
      setSuccess("Nenhuma alteracao detectada.");
      setWarnings([]);
      return;
    }

    if (hasPaymentMismatch) {
      setConfirmSaveOpen(false);
      setError("Total das formas de pagamento diferente do valor da venda.");
      setErrorTarget("payments");
      setSuccess(null);
      setWarnings([]);
      return;
    }

    if (!trimmedReason) {
      setConfirmSaveOpen(false);
      setError("Informe o motivo da alteracao.");
      setErrorTarget("reason");
      setSuccess(null);
      setWarnings([]);
      return;
    }

    setSubmitting(true);
    setError(null);
    setErrorTarget(null);
    setSuccess(null);
    setWarnings([]);

    try {
      const response = await fetch("/api/painel/bilheteria/purchases/update", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          purchaseId: detail.purchaseId,
          purchaseDate,
          cpf,
          status,
          reason: trimmedReason,
          vouchers: vouchers.map((voucher) => ({
            id: voucher.id,
            status: voucher.status,
            value: voucher.unitValue,
            discountId: voucher.discountEditable
              ? voucher.discountId
                ? Number(voucher.discountId)
                : null
              : null,
          })),
          payments,
          actor: {
            name: actorName,
            cpf: actorCpf,
          },
        }),
      });

      if (!response.ok) {
        setConfirmSaveOpen(false);
        const payload = await readErrorPayload(
          response,
          "Nao foi possivel salvar a edicao da venda agora.",
        );
        setError(payload.message);
        setErrorTarget(resolveErrorTarget(payload.code));
        return;
      }

      const payload = (await response.json().catch(() => null)) as
        | { message?: string; warnings?: string[] }
        | null;

      const nextSuccess = payload?.message?.trim() || "Alteracoes salvas.";
      const nextWarnings = Array.isArray(payload?.warnings)
        ? payload.warnings.filter(
            (warning): warning is string =>
              typeof warning === "string" && warning.trim() !== "",
          )
        : [];

      setConfirmSaveOpen(false);
      setSuccess(nextSuccess);
      setWarnings(nextWarnings);
      setErrorTarget(null);
      const params = new URLSearchParams();
      params.set("success", nextSuccess);

      for (const warning of nextWarnings) {
        params.append("warning", warning);
      }

      router.replace(`${returnHref}${returnHref.includes("?") ? "&" : "?"}${params.toString()}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-[28px] border border-[#d7e5ef] bg-white p-6 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#5d7282]">
              Editar compra #{detail.purchaseId}
            </p>
            <h2 className="legacy-condensed mt-2 text-4xl text-[#205a7f]">
              Historico de vendas
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#5d7282]">
              Ajuste dados da compra, vouchers e pagamentos mantendo a mesma separacao operacional do painel legado.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {hasPaymentMismatch ? (
              <div className="rounded-full border border-[#f0d3a8] bg-[#fff6e3] px-4 py-2 text-xs font-semibold text-[#8a6100]">
                Pagamentos diferentes do total da venda
              </div>
            ) : null}
            <div
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${
                hasPaymentMismatch
                  ? "border border-[#f0d3a8] bg-[#fff6e3] text-[#8a6100]"
                  : "border border-[#cde2d2] bg-[#eef9f1] text-[#286445]"
              }`}
            >
              {hasPaymentMismatch ? "Divergente" : "Conferido"}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[22px] border border-[#d9e3eb] bg-[#f7fafc] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#5d7282]">
              Total da venda
            </div>
            <div className="mt-3 text-2xl font-semibold text-[#205a7f]">
              {formatMoney(voucherTotal)}
            </div>
          </div>
          <div className="rounded-[22px] border border-[#d9e3eb] bg-[#f7fafc] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#5d7282]">
              Tipo
            </div>
            <div className="mt-3 text-sm font-semibold text-[#205a7f]">
              {detail.typeLabel}
            </div>
          </div>
          <div className="rounded-[22px] border border-[#d9e3eb] bg-[#f7fafc] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#5d7282]">
              Status de conferencia
            </div>
            <div className="mt-3 text-sm font-semibold text-[#205a7f]">
              {hasPaymentMismatch ? "Divergente" : "Conferido"}
            </div>
          </div>
          <div className="rounded-[22px] border border-[#d9e3eb] bg-[#edf5fa] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#5d7282]">
              Total informado
            </div>
            <div className="mt-3 text-2xl font-semibold text-[#205a7f]">
              {formatMoney(paymentTotal)}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2 text-sm font-semibold text-[#345062]">
            Data da compra
            <input
              type="date"
              value={purchaseDate}
              onChange={(event) => setPurchaseDate(event.target.value)}
              aria-invalid={errorTarget === "purchaseDate"}
              className={`rounded-[16px] bg-white px-4 py-3 text-sm text-[#1b3447] ${
                errorTarget === "purchaseDate"
                  ? "border border-[#d35a45] bg-[#fff7f4]"
                  : "border border-[#c9d8e3]"
              }`}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#345062]">
            ID da compra
            <input
              value={String(detail.purchaseId)}
              readOnly
              className="rounded-[16px] border border-[#c9d8e3] bg-[#f7fafc] px-4 py-3 text-sm text-[#1b3447]"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#345062]">
            CPF
            <input
              value={cpf}
              onChange={(event) => setCpf(event.target.value)}
              aria-invalid={errorTarget === "cpf"}
              className={`rounded-[16px] bg-white px-4 py-3 text-sm text-[#1b3447] ${
                errorTarget === "cpf"
                  ? "border border-[#d35a45] bg-[#fff7f4]"
                  : "border border-[#c9d8e3]"
              }`}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#345062]">
            Status
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as "conc" | "pend" | "canc")
              }
              aria-invalid={errorTarget === "status"}
              className={`rounded-[16px] bg-white px-4 py-3 text-sm text-[#1b3447] ${
                errorTarget === "status"
                  ? "border border-[#d35a45] bg-[#fff7f4]"
                  : "border border-[#c9d8e3]"
              }`}
            >
              <option value="conc">Concluida</option>
              <option value="canc">Cancelada</option>
              <option value="pend">Em processamento</option>
            </select>
          </label>
        </div>

        <section
          className={`mt-6 rounded-[24px] bg-[#fbfdff] p-5 ${
            errorTarget === "vouchers"
              ? "border border-[#d35a45] bg-[#fff7f4]"
              : "border border-[#d9e3eb]"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#5d7282]">
                Vouchers
              </p>
              <p className="mt-2 text-sm leading-6 text-[#5d7282]">
                Ajuste status e desconto diretamente por voucher.
              </p>
            </div>
            <div className="text-sm font-semibold text-[#205a7f]">
              Total recalculado: {formatMoney(voucherTotal)}
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 overflow-hidden rounded-[20px] border border-[#d9e3eb] text-sm">
              <thead className="bg-[#edf5fa] text-left text-[#345062]">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Voucher</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Modalidade</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-right">Acao</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((voucher, index) => (
                  <tr
                    key={voucher.id}
                    className={`border-t border-[#e4edf4] align-top ${
                      voucher.cancelled ? "bg-[#fff3f3] opacity-80" : "bg-white"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#205a7f]">{voucher.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#205a7f]">
                        {voucher.number || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                        <div className="font-semibold text-[#205a7f]">{voucher.typeLabel}</div>
                      {voucher.baseTypeLabel !== voucher.typeLabel ? (
                        <div className="mt-1 text-xs text-[#5d7282]">
                          {voucher.baseTypeLabel}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={voucher.status}
                        onChange={(event) =>
                          updateVoucher(index, {
                            status: event.target.value as VoucherDraft["status"],
                            cancelled: event.target.value === "inv",
                          })
                        }
                        disabled={voucher.cancelled}
                        className="min-w-[160px] rounded-[14px] border border-[#c9d8e3] bg-white px-3 py-2 text-sm text-[#1b3447]"
                      >
                        <option value="n">Nao validado</option>
                        <option value="s">Validado</option>
                        <option value="inv">Invalido</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {voucher.discountEditable ? (
                        <select
                          value={voucher.discountId}
                          onChange={(event) =>
                            updateVoucher(index, {
                              discountId: event.target.value,
                              unitValue: discountUnitPrice(
                                voucher.baseUnitValue,
                                event.target.value,
                              ),
                              typeLabel: getVoucherDisplayLabel(
                                {
                                  ...voucher,
                                  discountId: event.target.value,
                                },
                                detail.discountOptions,
                              ),
                            })
                          }
                          disabled={voucher.cancelled}
                          className="min-w-[220px] rounded-[14px] border border-[#c9d8e3] bg-white px-3 py-2 text-sm text-[#1b3447]"
                        >
                          <option value="">Normal</option>
                          {detail.discountOptions.map((discount) => (
                            <option key={discount.id} value={String(discount.id)}>
                              {discount.typeDescription
                                ? `${discount.typeDescription} - ${discount.name}`
                                : discount.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="rounded-[14px] border border-[#d9e3eb] bg-[#f7fafc] px-3 py-2 text-sm text-[#5d7282]">
                          Sem modalidade
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={voucher.unitValue.replace(".", ",")}
                        onChange={(event) =>
                          updateVoucher(index, {
                            unitValue: event.target.value.replace(",", "."),
                          })
                        }
                        disabled={voucher.cancelled}
                        readOnly={voucher.discountEditable}
                        className="w-full min-w-[120px] rounded-[14px] border border-[#c9d8e3] bg-white px-3 py-2 text-right text-sm text-[#1b3447] read-only:bg-[#f7fafc]"
                      />
                      <div className="mt-1 text-right text-xs text-[#5d7282]">
                        Base {formatMoney(voucher.baseUnitValue)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => toggleVoucherCancellation(index)}
                        className={`rounded-full px-3 py-2 text-xs font-semibold ${
                          voucher.cancelled
                            ? "border border-[#c9d8e3] text-[#205a7f]"
                            : "bg-[#9f3d2f] text-white"
                        }`}
                      >
                        {voucher.cancelled ? "Desfazer cancelamento" : "Cancelar voucher"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className={`mt-6 rounded-[24px] bg-[#fbfdff] p-5 ${
            errorTarget === "payments"
              ? "border border-[#d35a45] bg-[#fff7f4]"
              : "border border-[#d9e3eb]"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#5d7282]">
                Pagamentos
              </p>
              <h3 className="mt-2 text-xl font-semibold text-[#205a7f]">
                Formas de pagamento
              </h3>
            </div>
            <button
              type="button"
              onClick={addPaymentRow}
              className="rounded-full border border-[#c9d8e3] px-4 py-2 text-sm font-semibold text-[#205a7f] hover:bg-[#edf5fa]"
            >
              + Adicionar pagamento
            </button>
            <div
              className={`rounded-full px-4 py-2 text-xs font-semibold ${
                hasPaymentMismatch
                  ? "border border-[#f0d3a8] bg-[#fff6e3] text-[#8a6100]"
                  : "border border-[#cde2d2] bg-[#eef9f1] text-[#286445]"
              }`}
            >
              {hasPaymentMismatch
                ? "Total informado diferente do total da venda"
                : "Pagamentos conferidos"}
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 overflow-hidden rounded-[20px] border border-[#d9e3eb] text-sm">
              <thead className="bg-[#edf5fa] text-left text-[#345062]">
                <tr>
                  <th className="px-4 py-3">Forma</th>
                  <th className="px-4 py-3">Valor (R$)</th>
                  <th className="px-4 py-3 text-right">Acao</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment, index) => (
                  <tr
                    key={`history-payment-${index}`}
                    className="border-t border-[#e4edf4] bg-white align-top"
                  >
                    <td className="px-4 py-3">
                      <select
                        value={payment.method}
                        onChange={(event) =>
                          updatePayment(index, { method: event.target.value })
                        }
                        className="min-w-[220px] rounded-[14px] border border-[#c9d8e3] bg-white px-3 py-2 text-sm text-[#1b3447]"
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
                        className="w-full min-w-[140px] rounded-[14px] border border-[#c9d8e3] bg-white px-3 py-2 text-sm text-[#1b3447]"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => removePaymentRow(index)}
                        disabled={payments.length === 1}
                        className="rounded-full border border-[#d0dde7] px-4 py-2 text-xs font-semibold text-[#205a7f] disabled:opacity-50"
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <aside className="grid gap-6">
        <section className="rounded-[28px] border border-[#d7e5ef] bg-white p-6 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
          <label className="grid gap-2 text-sm font-semibold text-[#345062]">
            Explique o motivo da alteracao
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              aria-invalid={errorTarget === "reason"}
              className={`rounded-[18px] bg-white px-4 py-3 text-sm text-[#1b3447] ${
                errorTarget === "reason"
                  ? "border border-[#d35a45] bg-[#fff7f4]"
                  : "border border-[#c9d8e3]"
              }`}
              placeholder="Descreva o motivo"
            />
          </label>

          {error ? (
            <div className="mt-4 rounded-[18px] border border-[#f0bbb1] bg-[#fff2ef] px-4 py-3 text-sm text-[#9f3d2f]">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mt-4 rounded-[18px] border border-[#b9dec6] bg-[#eefaf2] px-4 py-3 text-sm text-[#286445]">
              {success}
            </div>
          ) : null}
          {warnings.length > 0 ? (
            <div className="mt-4 rounded-[18px] border border-[#f0d3a8] bg-[#fff6e3] px-4 py-3 text-sm text-[#8a6100]">
              <p className="font-semibold">Avisos apos salvar</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => router.replace(returnHref)}
              className="rounded-full border border-[#c9d8e3] px-5 py-3 text-sm font-semibold text-[#205a7f]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (hasPaymentMismatch) {
                  setConfirmSaveOpen(false);
                  setError("Total das formas de pagamento diferente do valor da venda.");
                  setErrorTarget("payments");
                  setSuccess(null);
                  setWarnings([]);
                  return;
                }

                setError(null);
                setErrorTarget(null);
                setSuccess(null);
                setWarnings([]);
                setConfirmSaveOpen(true);
              }}
              disabled={submitting}
              className="rounded-full bg-[#246b99] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "Salvando..." : "Salvar alteracoes"}
            </button>
          </div>
        </section>
      </aside>

      {confirmSaveOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,34,53,0.48)] px-6">
          <div className="w-full max-w-[560px] rounded-[28px] border border-[#d7e5ef] bg-white p-6 shadow-[0_26px_70px_rgba(16,45,70,0.22)]">
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-2xl font-semibold text-[#205a7f]">Confirmar</h3>
              <button
                type="button"
                onClick={() => setConfirmSaveOpen(false)}
                className="h-10 w-10 rounded-full border border-[#c9d8e3] text-xl font-semibold text-[#205a7f]"
              >
                &times;
              </button>
            </div>

            <p className="mt-4 text-sm leading-7 text-[#5d7282]">
              Deseja salvar as alteracoes desta venda?
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmSaveOpen(false)}
                className="rounded-full border border-[#c9d8e3] px-5 py-3 text-sm font-semibold text-[#205a7f]"
              >
                Nao
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                className="rounded-full bg-[#246b99] px-5 py-3 text-sm font-semibold text-white"
              >
                Sim, salvar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
