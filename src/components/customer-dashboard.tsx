"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AuthErrorResponse, AuthMeResponse } from "@/lib/auth-contracts";
import type { AuthUser } from "@/lib/auth-contracts";
import { CustomerAccountPanel } from "@/components/customer-account-panel";
import { CustomerAreaHero } from "@/components/customer-area-hero";
import {
  countAvailableVouchers,
  groupUserPurchasesByType,
} from "@/lib/voucher-groups";
import type {
  UserVoucher,
  UserVoucherRescheduleOption,
  UserVoucherRescheduleOptionsResponse,
  UserVoucherRescheduleResponse,
  UserVoucherPurchase,
  UserVouchersResponse,
} from "@/lib/voucher-contracts";

type CustomerDashboardProps = {
  initialSection: "account" | "vouchers";
};

const pageSize = 10;

async function readResponseBody<T>(response: Response) {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function readApiError(response: Response, fallback: string) {
  const payload = await readResponseBody<AuthErrorResponse>(response);

  if (payload && !payload.ok) {
    return payload.error.message;
  }

  return fallback;
}

async function fetchSessionUser(signal?: AbortSignal) {
  const response = await fetch("/api/auth/me", {
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    return {
      ok: false as const,
      error: {
        status: response.status,
        message: await readApiError(
          response,
          "Nao foi possivel consultar a sessao agora.",
        ),
      },
    };
  }

  const payload = await readResponseBody<AuthMeResponse>(response);

  if (!payload?.ok) {
    return {
      ok: false as const,
      error: {
        status: 502,
        message: "Nao foi possivel consultar a sessao agora.",
      },
    };
  }

  return {
    ok: true as const,
    data: payload.data,
  };
}

async function fetchVoucherPage(
  limit: number,
  offset: number,
  signal?: AbortSignal,
) {
  const response = await fetch(
    `/api/me/vouchers?limit=${limit}&offset=${offset}`,
    {
      cache: "no-store",
      signal,
    },
  );

  if (!response.ok) {
    return {
      ok: false as const,
      error: {
        status: response.status,
        message: await readApiError(
          response,
          "Nao foi possivel consultar os vouchers agora.",
        ),
      },
    };
  }

  const payload = await readResponseBody<UserVouchersResponse>(response);

  if (!payload?.ok) {
    return {
      ok: false as const,
      error: {
        status: 502,
        message: "Nao foi possivel consultar os vouchers agora.",
      },
    };
  }

  return {
    ok: true as const,
    data: payload.data,
  };
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatCurrency(value: string | null) {
  if (!value) {
    return "-";
  }

  const amount = Number(value);

  if (Number.isNaN(amount)) {
    return value;
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);
}

function voucherStatusBadge(voucher: UserVoucher) {
  if (voucher.used) {
    return "Usado";
  }

  if (voucher.expiredForGeneration) {
    return "Fora do prazo";
  }

  return "Disponivel";
}

function voucherStatusClasses(voucher: UserVoucher) {
  if (voucher.used) {
    return "bg-[#f4e8c8] text-[#7c6737]";
  }

  if (voucher.expiredForGeneration) {
    return "bg-[#fce7e3] text-[#a14f44]";
  }

  return "bg-[#e2f4ea] text-[#287450]";
}

function purchaseStatusClasses(purchase: UserVoucherPurchase) {
  if (purchase.status === "conc") {
    return "bg-[#e2f4ea] text-[#287450]";
  }

  if (purchase.status === "canc") {
    return "bg-[#fce7e3] text-[#a14f44]";
  }

  return "bg-[#e9f3fb] text-[#2c6485]";
}

function buildVoucherExportHref(purchaseId: number, voucherIds: number[]) {
  const params = new URLSearchParams();

  for (const voucherId of voucherIds) {
    params.append("voucherId", String(voucherId));
  }

  const query = params.toString();

  return query
    ? `/api/me/vouchers/${purchaseId}/export?${query}`
    : `/api/me/vouchers/${purchaseId}/export`;
}

function applyCanceledPurchase(purchase: UserVoucherPurchase) {
  return {
    ...purchase,
    status: "canc" as const,
    statusLabel: "Cancelado",
    canCancelReservation: false,
    canGenerateVoucher: false,
  };
}

function applyRescheduledVoucher(
  purchase: UserVoucherPurchase,
  voucherId: number,
  visitDate: string,
) {
  return {
    ...purchase,
    vouchers: purchase.vouchers.map((voucher) =>
      voucher.id === voucherId
        ? {
            ...voucher,
            visitDate,
            canReschedule: false,
          }
        : voucher,
    ),
  };
}

function PurchaseActions({
  purchase,
  onPurchaseCanceled,
}: {
  purchase: UserVoucherPurchase;
  onPurchaseCanceled: (purchaseId: number) => void;
}) {
  const exportableVoucherIds = purchase.vouchers
    .filter((voucher) => voucher.canSelectForVoucher)
    .map((voucher) => voucher.id);
  const selectionKey = exportableVoucherIds.join(",");
  const [selectionState, setSelectionState] = useState<{
    key: string;
    ids: number[];
  }>({
    key: selectionKey,
    ids: exportableVoucherIds,
  });
  const [cancelPending, setCancelPending] = useState(false);
  const [whatsAppPhone, setWhatsAppPhone] = useState("");
  const [whatsAppPending, setWhatsAppPending] = useState(false);
  const [whatsAppSuccess, setWhatsAppSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const selectedVoucherIds =
    selectionState.key === selectionKey
      ? selectionState.ids
      : exportableVoucherIds;
  const areAllSelectableVouchersSelected =
    exportableVoucherIds.length > 0 &&
    exportableVoucherIds.every((voucherId) =>
      selectedVoucherIds.includes(voucherId),
    );

  function toggleVoucherSelection(voucherId: number, checked: boolean) {
    setSelectionState((current) => {
      const currentIds =
        current.key === selectionKey ? current.ids : exportableVoucherIds;

      if (checked) {
        return {
          key: selectionKey,
          ids: currentIds.includes(voucherId)
            ? currentIds
            : [...currentIds, voucherId],
        };
      }

      return {
        key: selectionKey,
        ids: currentIds.filter(
          (currentVoucherId) => currentVoucherId !== voucherId,
        ),
      };
    });
  }

  function setAllVoucherSelections(checked: boolean) {
    setSelectionState({
      key: selectionKey,
      ids: checked ? exportableVoucherIds : [],
    });
  }

  async function handleCancelReservation() {
    setCancelPending(true);
    setActionError(null);

    try {
      const response = await fetch(`/api/me/vouchers/${purchase.id}/cancel`, {
        method: "POST",
      });

      if (!response.ok) {
        setActionError(
          await readApiError(
            response,
            "Nao foi possivel cancelar a reserva agora.",
          ),
        );
        return;
      }

      onPurchaseCanceled(purchase.id);
    } catch (requestError) {
      console.error("customer-cancel-reservation-failed", requestError);
      setActionError("Nao foi possivel cancelar a reserva agora.");
    } finally {
      setCancelPending(false);
    }
  }

  async function handleSendWhatsApp() {
    setWhatsAppPending(true);
    setActionError(null);
    setWhatsAppSuccess(null);

    try {
      const response = await fetch(`/api/me/vouchers/${purchase.id}/whatsapp`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          voucherIds: selectedVoucherIds,
          phoneNumber: whatsAppPhone,
        }),
      });

      if (!response.ok) {
        setActionError(
          await readApiError(
            response,
            "Nao foi possivel enviar os vouchers por WhatsApp agora.",
          ),
        );
        return;
      }

      setWhatsAppSuccess("Solicitacao enviada ao WhatsApp.");
    } catch (requestError) {
      console.error("customer-send-whatsapp-failed", requestError);
      setActionError("Nao foi possivel enviar os vouchers por WhatsApp agora.");
    } finally {
      setWhatsAppPending(false);
    }
  }

  if (!purchase.canGenerateVoucher && !purchase.canCancelReservation) {
    return null;
  }

  return (
    <div className="mt-4 space-y-4">
      {purchase.canGenerateVoucher ? (
        <div className="rounded-[22px] border border-[#d8e6f0] bg-[#f6fbff] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="legacy-rounded text-[15px] text-[#1d5b80]">
                Exportacao nativa de voucher
              </p>
              <p className="mt-1 text-sm leading-6 text-[#547083]">
                O PDF e gerado pelo BFF com QR Code e ja sai do novo frontend.
              </p>
            </div>

            <a
              href={buildVoucherExportHref(purchase.id, selectedVoucherIds)}
              target="_blank"
              rel="noreferrer"
              className={`legacy-button mt-0 ${
                selectedVoucherIds.length === 0
                  ? "pointer-events-none opacity-50"
                  : ""
              }`}
            >
              gerar {selectedVoucherIds.length} voucher
              {selectedVoucherIds.length === 1 ? "" : "es"}
            </a>
          </div>

          <div className="mt-4 grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#dbe8f1] bg-white px-4 py-3">
              <span className="text-sm text-[#2f5269]">
                {selectedVoucherIds.length} de {exportableVoucherIds.length} voucher
                {exportableVoucherIds.length === 1 ? "" : "es"} selecionado
                {exportableVoucherIds.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() =>
                  setAllVoucherSelections(!areAllSelectableVouchersSelected)
                }
                className="text-sm text-[#1d5b80] underline underline-offset-2"
              >
                {areAllSelectableVouchersSelected
                  ? "limpar selecao"
                  : "selecionar todos"}
              </button>
            </div>
            {purchase.vouchers
              .filter((voucher) => voucher.canSelectForVoucher)
              .map((voucher) => (
                <label
                  key={voucher.id}
                  className="flex items-center justify-between gap-3 rounded-[18px] border border-[#dbe8f1] bg-white px-4 py-3 text-left"
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedVoucherIds.includes(voucher.id)}
                      onChange={(event) =>
                        toggleVoucherSelection(voucher.id, event.target.checked)
                      }
                    />
                    <span className="text-sm text-[#2f5269]">
                      {voucher.typeLabel} • visita {formatDate(voucher.visitDate)} •{" "}
                      {formatCurrency(voucher.unitValue)}
                    </span>
                  </span>
                  <span className="text-xs text-[#6f8799]">
                    {voucher.number ?? `voucher #${voucher.id}`}
                  </span>
                </label>
              ))}
          </div>

          <div className="mt-4 rounded-[18px] border border-[#dbe8f1] bg-white px-4 py-4">
            <p className="text-sm text-[#2f5269]">
              Envio por WhatsApp
            </p>
            <p className="mt-1 text-sm leading-6 text-[#6a8395]">
              Informe o numero com DDD para receber os vouchers selecionados.
            </p>
            <div className="mt-3 flex flex-col gap-3 md:flex-row">
              <input
                type="tel"
                inputMode="tel"
                placeholder="(11) 99999-9999"
                value={whatsAppPhone}
                onChange={(event) => setWhatsAppPhone(event.target.value)}
                className="min-h-[44px] flex-1 rounded-[16px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 text-sm text-[#214d6b] outline-none"
              />
              <button
                type="button"
                onClick={handleSendWhatsApp}
                disabled={selectedVoucherIds.length === 0 || whatsAppPending}
                className="legacy-button mt-0 disabled:pointer-events-none disabled:opacity-50"
              >
                {whatsAppPending ? "enviando..." : "enviar no WhatsApp"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {purchase.canCancelReservation ? (
        <button
          type="button"
          onClick={handleCancelReservation}
          disabled={cancelPending}
          className="legacy-button mt-0"
        >
          {cancelPending ? "cancelando reserva..." : "cancelar reserva"}
        </button>
      ) : null}
      {actionError ? (
        <div className="rounded-[18px] border border-[#efc3c3] bg-[#fff3f1] px-4 py-3 text-sm text-[#9f3f36]">
          {actionError}
        </div>
      ) : null}
      {whatsAppSuccess ? (
        <div className="rounded-[18px] border border-[#cbe9d7] bg-[#eefaf2] px-4 py-3 text-sm text-[#287450]">
          {whatsAppSuccess}
        </div>
      ) : null}
    </div>
  );
}

function VoucherCardContent({
  voucher,
  onVoucherRescheduled,
}: {
  voucher: UserVoucher;
  onVoucherRescheduled?: (voucherId: number, visitDate: string) => void;
}) {
  const [options, setOptions] = useState<UserVoucherRescheduleOption[] | null>(null);
  const [selectedAgendaId, setSelectedAgendaId] = useState<string>("");
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleLoadOptions() {
    setLoadingOptions(true);
    setActionError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/me/vouchers/${voucher.id}/reschedule`, {
        cache: "no-store",
      });
      const payload = await readResponseBody<
        UserVoucherRescheduleOptionsResponse | AuthErrorResponse
      >(response);

      if (!response.ok || !payload?.ok) {
        setActionError(
          payload && !payload.ok
            ? payload.error.message
            : "Nao foi possivel consultar as datas agora.",
        );
        return;
      }

      setOptions(payload.data.options);
      setSelectedAgendaId(payload.data.options[0]?.id ? String(payload.data.options[0].id) : "");
    } catch (requestError) {
      console.error("customer-voucher-reschedule-options-failed", requestError);
      setActionError("Nao foi possivel consultar as datas agora.");
    } finally {
      setLoadingOptions(false);
    }
  }

  async function handleRescheduleSubmit() {
    const agendaId = Number(selectedAgendaId);

    if (!Number.isInteger(agendaId) || agendaId <= 0) {
      setActionError("Escolha uma nova data para reagendamento.");
      return;
    }

    setSubmitting(true);
    setActionError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/me/vouchers/${voucher.id}/reschedule`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ agendaId }),
      });
      const payload = await readResponseBody<
        UserVoucherRescheduleResponse | AuthErrorResponse
      >(response);

      if (!response.ok || !payload?.ok) {
        setActionError(
          payload && !payload.ok
            ? payload.error.message
            : "Nao foi possivel concluir o reagendamento agora.",
        );
        return;
      }

      setSuccessMessage(
        `Voucher reagendado para ${formatDate(payload.data.visitDate)}.`,
      );
      setOptions(null);
      setSelectedAgendaId("");
      onVoucherRescheduled?.(voucher.id, payload.data.visitDate);
    } catch (requestError) {
      console.error("customer-voucher-reschedule-submit-failed", requestError);
      setActionError("Nao foi possivel concluir o reagendamento agora.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className="rounded-[22px] border border-[#d6e5ef] bg-[#fbfdff] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="legacy-rounded text-[15px] text-[#1d5b80]">
            {voucher.typeLabel || "Voucher"}
          </p>
          <p className="mt-1 text-sm leading-6 text-[#50677a]">
            Numero: {voucher.number ?? "A gerar"}
          </p>
        </div>
        <span
          className={`legacy-rounded inline-flex rounded-full px-3 py-1 text-[12px] ${voucherStatusClasses(voucher)}`}
        >
          {voucherStatusBadge(voucher)}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-left sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <dt className="text-[11px] uppercase tracking-[0.16em] text-[#7d95a8]">
            Visita
          </dt>
          <dd className="mt-1 text-sm text-[#284a60]">
            {formatDate(voucher.visitDate)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.16em] text-[#7d95a8]">
            Uso
          </dt>
          <dd className="mt-1 text-sm text-[#284a60]">
            {formatDate(voucher.useDate)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.16em] text-[#7d95a8]">
            Valor
          </dt>
          <dd className="mt-1 text-sm text-[#284a60]">
            {formatCurrency(voucher.unitValue)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.16em] text-[#7d95a8]">
            Validade
          </dt>
          <dd className="mt-1 text-sm text-[#284a60]">
            {formatDate(voucher.validUntil)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-[#39586d]">
        {voucher.schoolName ? (
          <span className="rounded-full bg-[#eef5fb] px-3 py-1">
            Escola: {voucher.schoolName}
          </span>
        ) : null}
        {voucher.participantName ? (
          <span className="rounded-full bg-[#eef5fb] px-3 py-1">
            Participante: {voucher.participantName}
          </span>
        ) : null}
        {voucher.sent ? (
          <span className="rounded-full bg-[#eef5fb] px-3 py-1">
            Enviado
          </span>
        ) : null}
        {voucher.canReschedule ? (
          <button
            type="button"
            onClick={handleLoadOptions}
            disabled={loadingOptions || submitting}
            className="rounded-full bg-[#f4ecff] px-3 py-1 text-[#6b4d9a] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingOptions ? "Carregando datas..." : "Reagendar"}
          </button>
        ) : null}
      </div>

      {options ? (
        <div className="mt-4 rounded-[20px] border border-[#dbe8f1] bg-white p-4">
          <p className="legacy-rounded text-[14px] text-[#1d5b80]">
            Escolha a nova data da visita
          </p>
          <div className="mt-3 flex flex-col gap-3 md:flex-row">
            <select
              value={selectedAgendaId}
              onChange={(event) => setSelectedAgendaId(event.target.value)}
              className="min-h-[44px] flex-1 rounded-[16px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 text-sm text-[#214d6b] outline-none"
            >
              {options.length === 0 ? (
                <option value="">Nenhuma data disponivel</option>
              ) : null}
              {options.map((option) => (
                <option key={option.id} value={String(option.id)}>
                  {formatDate(option.date)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleRescheduleSubmit}
              disabled={submitting || options.length === 0}
              className="legacy-button mt-0"
            >
              {submitting ? "salvando..." : "confirmar reagendamento"}
            </button>
          </div>
        </div>
      ) : null}

      {successMessage ? (
        <div className="mt-4 rounded-[18px] border border-[#cbe9d7] bg-[#eefaf2] px-4 py-3 text-sm text-[#287450]">
          {successMessage}
        </div>
      ) : null}

      {actionError ? (
        <div className="mt-4 rounded-[18px] border border-[#efc3c3] bg-[#fff3f1] px-4 py-3 text-sm text-[#9f3f36]">
          {actionError}
        </div>
      ) : null}
    </article>
  );
}

function PurchaseCard({
  purchase,
  onPurchaseCanceled,
  onVoucherRescheduled,
}: {
  purchase: UserVoucherPurchase;
  onPurchaseCanceled: (purchaseId: number) => void;
  onVoucherRescheduled: (purchaseId: number, voucherId: number, visitDate: string) => void;
}) {
  return (
    <article className="rounded-[28px] border border-[#d6e5ef] bg-white p-5 shadow-[0_12px_32px_rgba(18,68,99,0.07)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="legacy-rounded text-[12px] uppercase tracking-[0.2em] text-[#6d8aa0]">
            Pedido {purchase.id}
          </p>
          <h3 className="legacy-rounded mt-2 text-[24px] leading-tight text-[#1d5b80]">
            {purchase.typeLabel}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#546b7d]">
            Compra em {formatDate(purchase.purchaseDate)} com{" "}
            {purchase.voucherCount} voucher
            {purchase.voucherCount === 1 ? "" : "s"}.
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 text-left md:items-end md:text-right">
          <span
            className={`legacy-rounded inline-flex rounded-full px-3 py-1 text-[12px] ${purchaseStatusClasses(purchase)}`}
          >
            {purchase.statusLabel}
          </span>
          <strong className="legacy-rounded text-[20px] text-[#214d6b]">
            {formatCurrency(purchase.totalValue)}
          </strong>
          <span className="text-xs uppercase tracking-[0.14em] text-[#7d95a8]">
            {purchase.payment.statusLabel}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[20px] bg-[#eef7fc] p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#7991a3]">
            Disponiveis
          </p>
          <p className="legacy-rounded mt-2 text-[26px] text-[#1d5b80]">
            {purchase.unusedVoucherCount}
          </p>
        </div>
        <div className="rounded-[20px] bg-[#f4f7fb] p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#7991a3]">
            Tipo
          </p>
          <p className="legacy-rounded mt-2 text-[20px] text-[#3e6178]">
            {purchase.type === "ponli" ? "Online" : "Reserva"}
          </p>
        </div>
        <div className="rounded-[20px] bg-[#f9f2e8] p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#8f7d69]">
            Origem legado
          </p>
          <p className="mt-2 break-all text-sm text-[#6d5847]">
            {purchase.legacyEncodedId}
          </p>
        </div>
      </div>

      <PurchaseActions purchase={purchase} onPurchaseCanceled={onPurchaseCanceled} />

      <div className="mt-5 grid gap-3">
        {purchase.vouchers.map((voucher) => (
          <VoucherCardContent
            key={voucher.id}
            voucher={voucher}
            onVoucherRescheduled={(voucherId, visitDate) =>
              onVoucherRescheduled(purchase.id, voucherId, visitDate)
            }
          />
        ))}
      </div>
    </article>
  );
}

function PurchaseSection({
  title,
  description,
  purchases,
  emptyMessage,
  onPurchaseCanceled,
  onVoucherRescheduled,
}: {
  title: string;
  description: string;
  purchases: UserVoucherPurchase[];
  emptyMessage: string;
  onPurchaseCanceled: (purchaseId: number) => void;
  onVoucherRescheduled: (purchaseId: number, voucherId: number, visitDate: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-[24px] bg-[#f7fbfe] px-5 py-4">
        <p className="legacy-rounded text-[18px] text-[#1d5b80]">{title}</p>
        <p className="mt-1 text-sm leading-6 text-[#587184]">{description}</p>
      </div>

      {purchases.length === 0 ? (
        <div className="rounded-[24px] bg-[#f7fbfe] px-5 py-8 text-center text-sm text-[#5c7284]">
          {emptyMessage}
        </div>
      ) : (
        purchases.map((purchase) => (
          <PurchaseCard
            key={purchase.id}
            purchase={purchase}
            onPurchaseCanceled={onPurchaseCanceled}
            onVoucherRescheduled={onVoucherRescheduled}
          />
        ))
      )}
    </div>
  );
}

export function CustomerDashboard({
  initialSection,
}: CustomerDashboardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [purchases, setPurchases] = useState<UserVoucherPurchase[]>([]);
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoutPending, setLogoutPending] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadInitialData() {
      setLoading(true);
      setError(null);

      const [userResult, vouchersResult] = await Promise.all([
        fetchSessionUser(controller.signal),
        fetchVoucherPage(pageSize, 0, controller.signal),
      ]);

      if (!active) {
        return;
      }

      const unauthenticated =
        (!userResult.ok && userResult.error.status === 401) ||
        (!vouchersResult.ok && vouchersResult.error.status === 401);

      if (unauthenticated) {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
        return;
      }

      if (userResult.ok) {
        setUser(userResult.data.user);
      } else {
        setError(userResult.error.message);
      }

      if (vouchersResult.ok) {
        setPurchases(vouchersResult.data.purchases);
        setTotalPurchases(vouchersResult.data.totalPurchases);
      } else {
        setPurchases([]);
        setTotalPurchases(0);
        setError((current) => current ?? vouchersResult.error.message);
      }

      setLoading(false);
    }

    void loadInitialData();

    return () => {
      active = false;
      controller.abort();
    };
  }, [pathname, router]);

  async function handleLoadMore() {
    setLoadingMore(true);
    setError(null);

    try {
      const vouchersResult = await fetchVoucherPage(
        pageSize,
        purchases.length,
      );

      if (!vouchersResult.ok) {
        if (vouchersResult.error.status === 401) {
          router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
          return;
        }

        setError(vouchersResult.error.message);
        return;
      }

      setPurchases((current) => [
        ...current,
        ...vouchersResult.data.purchases,
      ]);
      setTotalPurchases(vouchersResult.data.totalPurchases);
    } catch (requestError) {
      console.error("customer-vouchers-load-more-failed", requestError);
      setError("Nao foi possivel consultar mais pedidos agora.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleLogout() {
    setLogoutPending(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } catch (requestError) {
      console.error("customer-logout-failed", requestError);
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  function handlePurchaseCanceled(purchaseId: number) {
    setPurchases((current) =>
      current.map((purchase) =>
        purchase.id === purchaseId ? applyCanceledPurchase(purchase) : purchase,
      ),
    );
  }

  function handleVoucherRescheduled(
    purchaseId: number,
    voucherId: number,
    visitDate: string,
  ) {
    setPurchases((current) =>
      current.map((purchase) =>
        purchase.id === purchaseId
          ? applyRescheduledVoucher(purchase, voucherId, visitDate)
          : purchase,
      ),
    );
  }

  const groupedPurchases = groupUserPurchasesByType(purchases);
  const onlinePurchases = groupedPurchases.online;
  const reservationPurchases = groupedPurchases.reservations;
  const availableVoucherCount = countAvailableVouchers(purchases);
  const hasMore = purchases.length < totalPurchases;

  return (
    <section className="w-full">
      <CustomerAreaHero
        title={initialSection === "account" ? "Minha Conta" : "Meus Ingressos"}
        subtitle="A sessao, o cadastro do cliente, a troca de senha, a consulta de pedidos, a exportacao de vouchers e o cancelamento de reservas ja rodam no novo frontend."
        imageSrc={
          initialSection === "account"
            ? "/photos/quem-somos.jpg"
            : "/photos/confraternizacao.jpg"
        }
      />

      <div className="mx-auto w-full max-w-[1180px] px-4 pb-12 md:px-6">
        <div className="rounded-[28px] border border-[#d7e4ee] bg-white p-4 shadow-[0_16px_38px_rgba(17,66,97,0.09)] md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav className="flex flex-wrap gap-2">
              <Link
                href="/minha-conta"
                className={`legacy-rounded inline-flex rounded-full px-4 py-2 text-[14px] ${
                  initialSection === "account"
                    ? "bg-[#1d5b80] text-white"
                    : "bg-[#eef6fb] text-[#245b7d]"
                }`}
              >
                Minha conta
              </Link>
              <Link
                href="/meus-ingressos"
                className={`legacy-rounded inline-flex rounded-full px-4 py-2 text-[14px] ${
                  initialSection === "vouchers"
                    ? "bg-[#1d5b80] text-white"
                    : "bg-[#eef6fb] text-[#245b7d]"
                }`}
              >
                Meus ingressos
              </Link>
            </nav>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleLogout}
                disabled={logoutPending}
                className="legacy-rounded inline-flex min-h-[36px] items-center justify-center rounded-full border border-[#c5d8e6] px-4 text-[14px] text-[#295c7b] hover:bg-[#f3f9fd] disabled:cursor-not-allowed disabled:text-[#94a9ba]"
              >
                {logoutPending ? "Saindo..." : "Sair"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="space-y-6">
            <section className="rounded-[30px] bg-[linear-gradient(145deg,#205f86,#164661)] p-6 text-left text-white shadow-[0_24px_55px_rgba(20,62,91,0.18)]">
              <p className="legacy-rounded text-[12px] uppercase tracking-[0.28em] text-white/72">
                Sessao atual
              </p>
              <h2 className="legacy-rounded mt-3 text-[28px] leading-[1.15]">
                {loading ? "Carregando..." : user?.name ?? "Cliente"}
              </h2>

              <dl className="mt-5 grid gap-3 text-sm leading-7 text-white/88">
                <div className="rounded-[22px] border border-white/12 bg-white/10 px-4 py-3">
                  <dt className="text-[11px] uppercase tracking-[0.16em] text-white/65">
                    CPF
                  </dt>
                  <dd>{loading ? "..." : user?.cpfMasked ?? "-"}</dd>
                </div>
                <div className="rounded-[22px] border border-white/12 bg-white/10 px-4 py-3">
                  <dt className="text-[11px] uppercase tracking-[0.16em] text-white/65">
                    E-mail
                  </dt>
                  <dd>{loading ? "..." : user?.email ?? "Nao informado"}</dd>
                </div>
                <div className="rounded-[22px] border border-white/12 bg-white/10 px-4 py-3">
                  <dt className="text-[11px] uppercase tracking-[0.16em] text-white/65">
                    Operacoes migradas
                  </dt>
                  <dd>{loading ? "..." : "Login, cadastro, senha e vouchers prontos"}</dd>
                </div>
              </dl>
            </section>

            {initialSection === "account" ? (
              <CustomerAccountPanel onProfileSaved={setUser} />
            ) : null}

            <section className="grid gap-4 sm:grid-cols-2">
              <article className="rounded-[24px] border border-[#d6e5ef] bg-white p-5 text-left shadow-[0_12px_30px_rgba(17,66,97,0.07)]">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#7b95a8]">
                  Pedidos listados
                </p>
                <p className="legacy-rounded mt-2 text-[34px] text-[#1d5b80]">
                  {loading ? "-" : totalPurchases}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#587184]">
                  Compras e reservas retornadas pelo BFF.
                </p>
              </article>
              <article className="rounded-[24px] border border-[#d6e5ef] bg-white p-5 text-left shadow-[0_12px_30px_rgba(17,66,97,0.07)]">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#7b95a8]">
                  Vouchers disponiveis
                </p>
                <p className="legacy-rounded mt-2 text-[34px] text-[#1d5b80]">
                  {loading ? "-" : availableVoucherCount}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#587184]">
                  Itens ainda nao usados e dentro das regras atuais.
                </p>
              </article>
            </section>

            <section className="rounded-[28px] border border-dashed border-[#c8dae8] bg-[#f7fbfe] p-6 text-left">
              <h2 className="legacy-rounded text-[24px] text-[#1d5b80]">
                Area migrada
              </h2>
              <ul className="mt-4 space-y-2 text-sm leading-7 text-[#4d6477]">
                <li>Checkout e pagamento operando na stack Next/Cielo.</li>
                <li>Conta, vouchers e reagendamento atendidos pelo BFF nativo.</li>
                <li>Operacao e bilheteria centralizadas no painel Next.</li>
              </ul>
            </section>
          </div>

          <div className="space-y-6">
            {error ? (
              <div className="rounded-[24px] border border-[#efc3c3] bg-[#fff3f1] px-5 py-4 text-left text-sm text-[#9f3f36]">
                {error}
              </div>
            ) : null}

            <section className="grid gap-4 md:grid-cols-3">
              <article className="rounded-[24px] bg-[#eef7fc] p-5 text-left">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#7b95a8]">
                  Compras online
                </p>
                <p className="legacy-rounded mt-2 text-[30px] text-[#1d5b80]">
                  {loading ? "-" : onlinePurchases.length}
                </p>
              </article>
              <article className="rounded-[24px] bg-[#f4f7fb] p-5 text-left">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#7b95a8]">
                  Reservas
                </p>
                <p className="legacy-rounded mt-2 text-[30px] text-[#1d5b80]">
                  {loading ? "-" : reservationPurchases.length}
                </p>
              </article>
              <article className="rounded-[24px] bg-[#f9f2e8] p-5 text-left">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#8f7d69]">
                  Fonte
                </p>
                <p className="legacy-rounded mt-2 text-[20px] text-[#705535]">
                  Postgres + BFF
                </p>
              </article>
            </section>

            <section className="rounded-[30px] border border-[#d6e5ef] bg-white p-6 text-left shadow-[0_16px_38px_rgba(17,66,97,0.09)]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="legacy-rounded text-[12px] uppercase tracking-[0.22em] text-[#7b95a8]">
                    Pedidos e vouchers
                  </p>
                  <h2 className="legacy-rounded mt-2 text-[28px] leading-tight text-[#1d5b80]">
                    Fluxo de vouchers fechado no novo frontend
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#587184]">
                    Compra, exportacao, cancelamento e reagendamento agora ficam na mesma jornada do BFF.
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="mt-6 rounded-[24px] bg-[#f7fbfe] px-5 py-8 text-center text-sm text-[#5c7284]">
                  Consultando sessao, pedidos e vouchers...
                </div>
              ) : (
                <div className="mt-6 space-y-6">
                  <PurchaseSection
                    title="Compras online"
                    description="Pedidos pagos com vouchers prontos para selecao e exportacao em PDF."
                    purchases={onlinePurchases}
                    emptyMessage="Nenhuma compra online encontrada para esta conta."
                    onPurchaseCanceled={handlePurchaseCanceled}
                    onVoucherRescheduled={handleVoucherRescheduled}
                  />
                  <PurchaseSection
                    title="Reservas"
                    description="Reservas abertas com cancelamento disponivel enquanto ainda houver vouchers nao usados."
                    purchases={reservationPurchases}
                    emptyMessage="Nenhuma reserva encontrada para esta conta."
                    onPurchaseCanceled={handlePurchaseCanceled}
                    onVoucherRescheduled={handleVoucherRescheduled}
                  />
                </div>
              )}

              {hasMore ? (
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="legacy-rounded inline-flex min-h-[42px] items-center justify-center rounded-full border border-[#c5d8e6] px-5 text-[14px] text-[#295c7b] hover:bg-[#f3f9fd] disabled:cursor-not-allowed disabled:text-[#94a9ba]"
                  >
                    {loadingMore ? "Carregando..." : "Carregar mais pedidos"}
                  </button>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
