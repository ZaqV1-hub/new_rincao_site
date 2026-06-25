"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  PAINEL_BILHETERIA_SALE_DRAFT_KEY,
  type PainelBilheteriaSaleDraft,
} from "@/lib/painel-bilheteria-sales";

type PaymentRow = {
  id: string;
  method: string;
  value: string;
};

type SaleResponse = {
  ok: boolean;
  data?: {
    purchaseId: number;
    voucherIds: number[];
    message: string;
  };
  error?: {
    message?: string;
  };
};

type WhatsappResponse = {
  ok: boolean;
  data?: {
    ok?: boolean;
    message?: string;
  };
  error?: {
    message?: string;
  };
};

const paymentOptions = [
  { value: "dinhe", label: "Dinheiro" },
  { value: "debit", label: "Debito" },
  { value: "credi", label: "Credito" },
  { value: "pix", label: "Pix" },
  { value: "chequ", label: "Cheque" },
  { value: "tranb", label: "Trans. bancaria" },
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function parseMoney(value: string | null | undefined) {
  const raw = String(value ?? "").trim().replace(/^R\$\s*/i, "");
  const normalized =
    raw.includes(",") && raw.includes(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.includes(",")
        ? raw.replace(",", ".")
        : raw;
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

function createRow(id: string, value: string, method = ""): PaymentRow {
  return { id, method, value };
}

function createId() {
  return `pg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readSaleDraftFromSessionStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = sessionStorage.getItem(PAINEL_BILHETERIA_SALE_DRAFT_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PainelBilheteriaSaleDraft;
  } catch {
    return null;
  }
}

export function PainelBilheteriaSaleFinalize() {
  const router = useRouter();
  const [draft] = useState<PainelBilheteriaSaleDraft | null>(() =>
    readSaleDraftFromSessionStorage(),
  );
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>(() => {
    const initialDraft = readSaleDraftFromSessionStorage();
    return initialDraft ? [createRow("0", initialDraft.totalValue, "")] : [];
  });
  const [cashReceived, setCashReceived] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    purchaseId: number;
    voucherIds: number[];
    message: string;
  } | null>(null);
  const [whatsOpen, setWhatsOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [whatsSubmitting, setWhatsSubmitting] = useState(false);
  const [whatsMessage, setWhatsMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!draft) {
      router.replace("/painel/bilheteria/vendas");
    }
  }, [draft, router]);

  const totalPurchase = useMemo(() => parseMoney(draft?.totalValue), [draft]);
  const totalInformed = useMemo(
    () => paymentRows.reduce((total, payment) => total + parseMoney(payment.value), 0),
    [paymentRows],
  );
  const difference = Math.round((totalInformed - totalPurchase) * 100) / 100;
  const showCashReceived = paymentRows.some((payment) => payment.method === "dinhe");
  const cashChange = Math.max(parseMoney(cashReceived) - totalPurchase, 0);

  function updatePaymentRow(id: string, patch: Partial<PaymentRow>) {
    setPaymentRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function addPaymentRow() {
    setPaymentRows((current) => [...current, createRow(createId(), "", "")]);
  }

  function removePaymentRow(id: string) {
    setPaymentRows((current) => current.filter((row) => row.id !== id));
  }

  async function handleConfirmPayment() {
    if (!draft) {
      return;
    }

    const normalizedPayments = paymentRows
      .map((payment) => ({
        method: payment.method,
        value: payment.value,
      }))
      .filter((payment) => payment.method && parseMoney(payment.value) > 0);

    if (normalizedPayments.length === 0) {
      setErrorMessage("Informe ao menos uma forma de pagamento.");
      return;
    }

    if (Math.abs(difference) > 0.01) {
      setErrorMessage("O total informado precisa bater com o total da compra.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/painel/bilheteria/sales", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          agendaId: draft.agendaId,
          cpf: draft.cpf,
          items: draft.items.map((item) => ({
            type: item.type,
            quantity: item.quantity,
            label: item.label,
          })),
          purchaseDiscountId: draft.purchaseDiscountId,
          courtesies: draft.courtesies.map((courtesy) => ({
            authorId: courtesy.authorId,
            quantity: courtesy.quantity,
            identification: courtesy.identification,
            note: courtesy.note,
          })),
          payments: normalizedPayments,
          reason: draft.reason,
          idempotencyKey: createId(),
        }),
      });
      const payload = (await response.json().catch(() => null)) as SaleResponse | null;

      if (!response.ok || !payload?.ok || !payload.data) {
        setErrorMessage(
          payload?.error?.message || "Nao foi possivel confirmar a venda agora.",
        );
        return;
      }

      setSuccess({
        purchaseId: payload.data.purchaseId,
        voucherIds: payload.data.voucherIds,
        message: payload.data.message,
      });
      sessionStorage.removeItem(PAINEL_BILHETERIA_SALE_DRAFT_KEY);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendWhatsapp() {
    if (!success) {
      return;
    }

    setWhatsSubmitting(true);
    setWhatsMessage(null);

    try {
      const response = await fetch(
        `/api/painel/bilheteria/purchases/${success.purchaseId}/whatsapp`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            phoneNumber,
            voucherIds: success.voucherIds,
          }),
        },
      );
      const payload =
        (await response.json().catch(() => null)) as WhatsappResponse | null;

      if (!response.ok || !payload?.ok) {
        setWhatsMessage(
          payload?.error?.message ||
            "Nao foi possivel enviar os passaportes por WhatsApp.",
        );
        return;
      }

      setWhatsMessage(
        payload.data?.message || "Passaportes enviados por WhatsApp com sucesso.",
      );
    } finally {
      setWhatsSubmitting(false);
    }
  }

  if (!draft) {
    return null;
  }

  return (
    <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
      <article className="panel-section p-3.5">
        <p className="panel-eyebrow">Resumo</p>
        <h2 className="mt-1 text-[20px] font-black text-[#17351f]">Fechamento</h2>
        <p className="mt-1 text-xs text-[#5f7564]">Agenda: {draft.agendaLabel}</p>

        <div className="mt-3 overflow-hidden rounded-[12px] border border-[#dbe7d7]">
          <table className="min-w-full text-sm">
            <tbody>
              {draft.items.map((item) => (
                <tr key={`${item.type}-${item.label}`} className="bg-white">
                  <td className="px-3 py-2.5 text-[#17351f]">
                    <div className="font-semibold">{item.label}</div>
                    <div className="mt-1 text-xs text-[#5f7564]">
                      {item.quantity} x {formatMoney(parseMoney(item.baseUnitValue))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-[#17351f]">
                    {formatMoney(parseMoney(item.totalValue))}
                  </td>
                </tr>
              ))}
              {draft.courtesies.map((courtesy) => (
                <tr
                  key={`${courtesy.authorId}-${courtesy.identification}-${courtesy.note}`}
                  className="bg-[#fbfdf9]"
                >
                  <td className="px-3 py-2.5 text-[#17351f]">
                    <div className="font-semibold">Cortesia {courtesy.authorName}</div>
                    <div className="mt-1 text-xs text-[#5f7564]">{courtesy.quantity} unidade(s)</div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-[#17351f]">
                    {formatMoney(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 grid gap-2 rounded-[12px] border border-[#dbe7d7] bg-[#f7fbf5] px-3 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[#5f7564]">Subtotal</span>
            <strong className="text-[#17351f]">
              {formatMoney(parseMoney(draft.subtotalValue))}
            </strong>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[#5f7564]">
              {draft.purchaseDiscountLabel || "Desconto"}
            </span>
            <strong className="text-[#17351f]">
              - {formatMoney(parseMoney(draft.discountValue))}
            </strong>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[#dbe7d7] pt-3">
            <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#6f9565]">
              Total da compra
            </span>
            <strong className="text-[22px] font-black text-[#17351f]">
              {formatMoney(totalPurchase)}
            </strong>
          </div>
        </div>
      </article>

      <article className="panel-section p-3.5">
        {!success ? (
          <>
            <p className="panel-eyebrow">Pagamento</p>
            <h2 className="mt-1 text-[18px] font-black text-[#17351f]">
              Finalizar compra
            </h2>

            <button
              type="button"
              onClick={addPaymentRow}
              className="mt-3 rounded-[8px] border border-[#dbe7d7] px-3 py-2 text-xs font-semibold text-[#17351f]"
            >
              Adicionar forma
            </button>

            <div className="mt-3 space-y-2">
              {paymentRows.map((payment, index) => (
                <div
                  key={payment.id}
                  className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_auto]"
                >
                  <select
                    value={payment.method}
                    onChange={(event) =>
                      updatePaymentRow(payment.id, { method: event.target.value })
                    }
                    className="rounded-[8px] border border-[#dbe7d7] px-3 py-2 text-sm text-[#17351f]"
                  >
                    <option value="">Selecione</option>
                    {paymentOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={payment.value}
                    onChange={(event) =>
                      updatePaymentRow(payment.id, { value: event.target.value })
                    }
                    readOnly={index === 0 && paymentRows.length === 1}
                    className="rounded-[8px] border border-[#dbe7d7] px-3 py-2 text-sm text-[#17351f]"
                  />
                  {paymentRows.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removePaymentRow(payment.id)}
                      className="rounded-[8px] border border-[#ecd2d0] px-2.5 py-1.5 text-xs font-semibold text-[#b24239]"
                    >
                      Remover
                    </button>
                  ) : (
                    <div />
                  )}
                </div>
              ))}
            </div>

            {showCashReceived ? (
              <div className="mt-3 grid gap-2 rounded-[12px] border border-[#dbe7d7] bg-[#f7fbf5] p-3">
                <label className="grid gap-1.5 text-[13px] font-semibold text-[#17351f]">
                  Valor entregue
                  <input
                    value={cashReceived}
                    onChange={(event) => setCashReceived(event.target.value)}
                    className="rounded-[8px] border border-[#dbe7d7] px-3 py-2 text-sm text-[#17351f]"
                  />
                </label>
                <div className="text-sm text-[#5f7564]">
                  Troco: <strong className="text-[#17351f]">{formatMoney(cashChange)}</strong>
                </div>
              </div>
            ) : null}

            <div className="mt-3 rounded-[12px] border border-[#dbe7d7] bg-[#f7fbf5] px-3 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#5f7564]">Total informado</span>
                <strong className="text-[#17351f]">{formatMoney(totalInformed)}</strong>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[#5f7564]">Total da compra</span>
                <strong className="text-[#17351f]">{formatMoney(totalPurchase)}</strong>
              </div>
            </div>

            {errorMessage ? (
              <div className="mt-4 rounded-[12px] border border-[#f2d6d6] bg-[#fff1f1] px-4 py-3 text-sm text-[#8b2d2d]">
                {errorMessage}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5">
              <Link
                href="/painel/bilheteria/vendas"
                className="rounded-[8px] border border-[#dbe7d7] px-3 py-2 text-sm font-semibold text-[#17351f]"
              >
                Voltar
              </Link>
              <button
                type="button"
                onClick={() => void handleConfirmPayment()}
                disabled={submitting}
                className="rounded-[8px] bg-[#2b8c46] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting ? "Confirmando..." : "Confirmar pagamento"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="panel-eyebrow">Pagamento concluido</p>
            <h2 className="mt-1 text-[18px] font-black text-[#17351f]">
              Compra #{success.purchaseId}
            </h2>
            <p className="mt-2 text-sm text-[#5f7564]">{success.message}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`/painel/bilheteria/compras/${success.purchaseId}/imprimir`}
                target="_blank"
                rel="noreferrer"
                className="rounded-[8px] bg-[#2b8c46] px-3 py-2 text-sm font-semibold text-white"
              >
                Imprimir QRs
              </a>
              <button
                type="button"
                onClick={() => setWhatsOpen(true)}
                className="rounded-[8px] bg-[#25D366] px-3 py-2 text-sm font-semibold text-white"
              >
                Enviar WhatsApp
              </button>
              <Link
                href="/painel/bilheteria/vendas"
                className="rounded-[8px] border border-[#dbe7d7] px-3 py-2 text-sm font-semibold text-[#17351f]"
              >
                Nova venda
              </Link>
            </div>
          </>
        )}
      </article>

      {whatsOpen && success ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b223580] p-4">
          <div className="w-full max-w-md rounded-[18px] bg-white p-5 shadow-[0_24px_60px_rgba(16,45,70,0.24)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-black text-[#17351f]">
                Enviar passaportes por WhatsApp
              </h3>
              <button
                type="button"
                onClick={() => setWhatsOpen(false)}
                className="rounded-[8px] border border-[#dbe7d7] px-3 py-1.5 text-xs font-semibold text-[#5d745f]"
              >
                Fechar
              </button>
            </div>

            <label className="mt-4 grid gap-1.5 text-[13px] font-semibold text-[#17351f]">
              Telefone com DDD
              <input
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="(DDD) 9xxxx-xxxx"
                className="rounded-[8px] border border-[#dbe7d7] px-3 py-2.5 text-sm text-[#17351f]"
              />
            </label>

            {whatsMessage ? (
              <div className="mt-4 rounded-[12px] border border-[#dbe7d7] bg-[#f7fbf5] px-4 py-3 text-sm text-[#5f7564]">
                {whatsMessage}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void handleSendWhatsapp()}
              disabled={whatsSubmitting}
              className="mt-4 inline-flex w-full items-center justify-center rounded-[8px] bg-[#25D366] px-4 py-3 text-sm font-black text-white disabled:opacity-60"
            >
              {whatsSubmitting ? "Enviando..." : "Enviar"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
