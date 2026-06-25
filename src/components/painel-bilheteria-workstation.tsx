"use client";

import Link from "next/link";
import { useState } from "react";
import { legacyPanelContracts } from "@/lib/legacy-panel-contracts";
import { formatPainelBilheteriaDate } from "@/lib/painel-bilheteria-format";
import {
  type PainelBilheteriaCustomerLookupResult,
  type PainelBilheteriaTicketLookupResult,
} from "@/lib/painel-bilheteria-workstation";

type WorkstationMessage = {
  tone: "success" | "error" | "warning";
  text: string;
  warnings?: string[];
};

type VoucherValidationResponse = {
  ok: boolean;
  data?: {
    message?: string;
    warnings?: string[];
  };
  error?: {
    message?: string;
  };
};

type LookupResponse<T> = {
  ok: boolean;
  data?: T;
  error?: {
    message?: string;
  };
};

type PainelBilheteriaWorkstationProps = {
  actorName?: string | null;
  actorCpf?: string | null;
  isManager?: boolean;
  initialTicketLookupState?: {
    isOpen: boolean;
    lookup: string;
    result: PainelBilheteriaTicketLookupResult | null;
    error: string | null;
  };
};

function messageToneClasses(tone: WorkstationMessage["tone"]) {
  if (tone === "success") {
    return "border-[#b9dec6] bg-[#eefaf2] text-[#286445]";
  }

  if (tone === "warning") {
    return "border-[#f0d3a8] bg-[#fff6e3] text-[#8a6100]";
  }

  return "border-[#ebccd1] bg-[#f2dede] text-[#a94442]";
}

function actionButtonClasses(active = false) {
  return active
    ? "border-[#1f7a3d] bg-[#23823f] text-white"
    : "border border-[#dbe7d7] bg-white text-[#17351f] hover:bg-[#f6faf3]";
}

function WorkstationFormIcon({ formId }: { formId: string }) {
  const className = "h-8 w-8 text-[#244f2c]";

  switch (formId) {
    case "voucher-validation":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M7 7.5h10a2 2 0 0 1 2 2v1.5a2 2 0 0 0-2 2 2 2 0 0 0 2 2V16.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V15a2 2 0 0 0 0-4V9.5a2 2 0 0 1 2-2Z" />
          <path d="M9.5 10h5M9.5 14h5" />
        </svg>
      );
    case "customer-validation":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M12 20s7-4.4 7-10a7 7 0 1 0-14 0c0 5.6 7 10 7 10Z" />
          <path d="M12 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM18 7h3M19.5 5.5v3" />
        </svg>
      );
  }
}

function WorkstationActionIcon({ actionKey }: { actionKey?: string }) {
  const className = "h-6 w-6 shrink-0";

  switch (actionKey) {
    case "sales":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M5 18V10M12 18V6M19 18V13" />
          <path d="M3 18h18" />
        </svg>
      );
    case "cash-closure":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M5 7h14v11H5z" />
          <path d="M8 7V5h8v2M8 12h8M8 15h3" />
        </svg>
      );
    case "cash-fund":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M4 7.5h16v10H4z" />
          <path d="M15 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM7 10h.01M17 14h.01" />
        </svg>
      );
    case "history":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M4 12a8 8 0 1 0 3-6.24" />
          <path d="M4 4v4h4M12 8v5l3 2" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M7 7.5h10a2 2 0 0 1 2 2v1.5a2 2 0 0 0-2 2 2 2 0 0 0 2 2V16.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V15a2 2 0 0 0 0-4V9.5a2 2 0 0 1 2-2Z" />
          <path d="M9.5 10h5M9.5 14h5" />
        </svg>
      );
  }
}

async function readJson<T>(response: Response) {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function PainelBilheteriaWorkstation({
  actorName = null,
  actorCpf = null,
  isManager = false,
  initialTicketLookupState,
}: PainelBilheteriaWorkstationProps) {
  const contract = legacyPanelContracts.bilheteriaIndex;
  const [voucherNumber, setVoucherNumber] = useState("");
  const [customerDocument, setCustomerDocument] = useState("");
  const [ticketLookup, setTicketLookup] = useState(initialTicketLookupState?.lookup ?? "");
  const [ticketLookupOpen, setTicketLookupOpen] = useState(
    initialTicketLookupState?.isOpen ?? false,
  );
  const [ticketLookupResult, setTicketLookupResult] =
    useState<PainelBilheteriaTicketLookupResult | null>(
      initialTicketLookupState?.result ?? null,
    );
  const [ticketLookupError, setTicketLookupError] = useState<string | null>(
    initialTicketLookupState?.error ?? null,
  );
  const [ticketWhatsappPhone, setTicketWhatsappPhone] = useState("");
  const [ticketWhatsappError, setTicketWhatsappError] = useState<string | null>(null);
  const [ticketWhatsappSuccess, setTicketWhatsappSuccess] = useState<string | null>(
    null,
  );
  const [sendingTicketWhatsapp, setSendingTicketWhatsapp] = useState(false);
  const [message, setMessage] = useState<WorkstationMessage | null>(null);
  const [customerLookup, setCustomerLookup] =
    useState<PainelBilheteriaCustomerLookupResult | null>(null);
  const [selectedCustomerVouchers, setSelectedCustomerVouchers] = useState<
    Record<number, number[]>
  >({});
  const [purchaseWhatsappPhones, setPurchaseWhatsappPhones] = useState<
    Record<number, string>
  >({});
  const [runningActionKey, setRunningActionKey] = useState<string | null>(null);
  const [submittingVoucher, setSubmittingVoucher] = useState(false);
  const [submittingCustomer, setSubmittingCustomer] = useState(false);
  const hasServerDrivenTicketLookup = Boolean(initialTicketLookupState?.isOpen);

  function normalizeVoucherIds(voucherIds: number[]) {
    return [...new Set(voucherIds.filter((voucherId) => voucherId > 0))];
  }

  function updateSelectedPurchaseVouchers(purchaseId: number, voucherIds: number[]) {
    setSelectedCustomerVouchers((current) => ({
      ...current,
      [purchaseId]: normalizeVoucherIds(voucherIds),
    }));
  }

  function toggleSelectedPurchaseVoucher(purchaseId: number, voucherId: number) {
    setSelectedCustomerVouchers((current) => {
      const selected = current[purchaseId] ?? [];
      const next = selected.includes(voucherId)
        ? selected.filter((item) => item !== voucherId)
        : [...selected, voucherId];

      return {
        ...current,
        [purchaseId]: normalizeVoucherIds(next),
      };
    });
  }

  function isActionRunning(actionKey: string) {
    return runningActionKey === actionKey;
  }

  async function loadCustomerLookup(document: string) {
    const response = await fetch("/api/painel/bilheteria/customer-lookup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        document,
      }),
    });
    const payload =
      await readJson<LookupResponse<PainelBilheteriaCustomerLookupResult>>(response);

    if (!response.ok || !payload?.ok || !payload.data) {
      setMessage({
        tone: "error",
        text: payload?.error?.message || "Nao foi possivel consultar este cliente.",
      });
      setCustomerLookup(null);
      return null;
    }

    const data = payload.data;
    setCustomerLookup(data);
    setSelectedCustomerVouchers(
      Object.fromEntries(data.purchases.map((purchase) => [purchase.purchaseId, []])),
    );
    setMessage({
      tone: data.purchases.length > 0 ? "success" : "warning",
      text:
        data.purchases.length > 0
          ? `${data.purchases.length} compra(s) encontrada(s).`
          : "Nenhuma compra concluida encontrada para este cliente.",
    });
    return data;
  }

  async function runVoucherMutation(
    actionKey: string,
    endpoint: string,
    body: Record<string, unknown>,
  ) {
    setRunningActionKey(actionKey);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const payload = await readJson<VoucherValidationResponse>(response);

      if (!response.ok || !payload?.ok) {
        setMessage({
          tone: "error",
          text: payload?.error?.message || "Nao foi possivel concluir esta acao agora.",
        });
        return false;
      }

      setMessage({
        tone: payload.data?.warnings?.length ? "warning" : "success",
        text: payload.data?.message || "Operacao concluida com sucesso.",
        warnings: payload.data?.warnings || [],
      });
      return true;
    } finally {
      setRunningActionKey(null);
    }
  }

  async function refreshCustomerLookup() {
    if (!customerDocument.trim()) {
      return;
    }

    setSubmittingCustomer(true);

    try {
      await loadCustomerLookup(customerDocument);
    } finally {
      setSubmittingCustomer(false);
    }
  }

  async function handleValidateSelectedPurchase(purchaseId: number, voucherIds: number[]) {
    if (voucherIds.length === 0) {
      setMessage({
        tone: "warning",
        text: "Selecione ao menos um voucher desta compra.",
      });
      return;
    }

    const ok = await runVoucherMutation(
      `validate-purchase-${purchaseId}`,
      "/api/painel/bilheteria/vouchers/validate",
      { voucherIds },
    );

    if (ok) {
      await refreshCustomerLookup();
    }
  }

  async function handleUnvalidateSelectedPurchase(purchaseId: number, voucherIds: number[]) {
    if (voucherIds.length === 0) {
      setMessage({
        tone: "warning",
        text: "Selecione ao menos um voucher desta compra para desvalidar.",
      });
      return;
    }

    const ok = await runVoucherMutation(
      `unvalidate-purchase-${purchaseId}`,
      "/api/painel/bilheteria/vouchers/unvalidate",
      { voucherIds },
    );

    if (ok) {
      await refreshCustomerLookup();
    }
  }

  function handlePrintSelectedPurchase(voucherIds: number[]) {
    if (voucherIds.length === 0 || typeof window === "undefined") {
      setMessage({
        tone: "warning",
        text: "Selecione ao menos um voucher para imprimir.",
      });
      return;
    }

    for (const voucherId of voucherIds) {
      window.open(
        `/painel/bilheteria/vouchers/${voucherId}/imprimir`,
        "_blank",
        "noopener,noreferrer",
      );
    }

    setMessage({
      tone: "success",
      text: `${voucherIds.length} voucher(s) enviado(s) para impressao.`,
    });
  }

  async function handleSendSelectedPurchaseWhatsapp(
    purchaseId: number,
    voucherIds: number[],
  ) {
    if (voucherIds.length === 0) {
      setMessage({
        tone: "warning",
        text: "Selecione ao menos um voucher para enviar no WhatsApp.",
      });
      return;
    }

    const phoneNumber = (purchaseWhatsappPhones[purchaseId] ?? "").replace(/\D+/g, "");

    if (phoneNumber.length < 11) {
      setMessage({
        tone: "warning",
        text: "Informe telefone com DDD para enviar os vouchers selecionados.",
      });
      return;
    }

    setRunningActionKey(`whatsapp-purchase-${purchaseId}`);

    try {
      const response = await fetch(
        `/api/painel/bilheteria/purchases/${purchaseId}/whatsapp`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            phoneNumber,
            voucherIds,
          }),
        },
      );
      const payload = await readJson<{
        ok: boolean;
        data?: {
          message?: string;
        };
        error?: {
          message?: string;
        };
      }>(response);

      if (!response.ok || !payload?.ok) {
        setMessage({
          tone: "error",
          text:
            payload?.error?.message ||
            "Nao foi possivel enviar os vouchers selecionados por WhatsApp.",
        });
        return;
      }

      setMessage({
        tone: "success",
        text:
          payload.data?.message || "Vouchers selecionados enviados por WhatsApp.",
      });
    } finally {
      setRunningActionKey(null);
    }
  }

  async function handleVoucherSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingVoucher(true);
    setCustomerLookup(null);

    try {
      const response = await fetch("/api/painel/bilheteria/vouchers/validate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          voucherNumber,
          actor: {
            name: actorName,
            cpf: actorCpf,
          },
        }),
      });
      const payload = await readJson<VoucherValidationResponse>(response);

      if (!response.ok || !payload?.ok) {
        setMessage({
          tone: "error",
          text: payload?.error?.message || "Não foi possível validar o voucher agora.",
        });
        return;
      }

      setMessage({
        tone: payload.data?.warnings?.length ? "warning" : "success",
        text: payload.data?.message || "Voucher validado com sucesso.",
        warnings: payload.data?.warnings || [],
      });
      setVoucherNumber("");
    } finally {
      setSubmittingVoucher(false);
    }
  }

  async function handleCustomerSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingCustomer(true);

    try {
      await loadCustomerLookup(customerDocument);
    } finally {
      setSubmittingCustomer(false);
    }
  }

  function handleTicketLookupSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const lookup = ticketLookup.trim();

    if (!lookup) {
      setTicketLookupError("Informe o ID do ingresso para consultar.");
      setTicketLookupResult(null);
      return;
    }
    const href = `/painel/bilheteria?ingresso=${encodeURIComponent(lookup)}`;

    if (typeof window !== "undefined") {
      window.location.assign(href);
    }
  }

  function handleOpenTicketLookup() {
    setTicketLookupOpen(true);
    setTicketLookupError(null);
    setTicketWhatsappError(null);
    setTicketWhatsappSuccess(null);
  }

  function handleCloseTicketLookup() {
    if (hasServerDrivenTicketLookup && typeof window !== "undefined") {
      window.location.assign("/painel/bilheteria");
      return;
    }

    setTicketLookupOpen(false);
    setTicketLookup("");
    setTicketLookupResult(null);
    setTicketLookupError(null);
    setTicketWhatsappPhone("");
    setTicketWhatsappError(null);
    setTicketWhatsappSuccess(null);
  }

  function handlePrintTicketLookup() {
    if (!ticketLookupResult || ticketLookupResult.used) {
      return;
    }

    if (typeof window !== "undefined") {
      window.open(
        `/painel/bilheteria/vouchers/${ticketLookupResult.voucherId}/imprimir`,
        "_blank",
        "noopener,noreferrer",
      );
    }
  }

  async function handleSendTicketLookupWhatsapp() {
    if (!ticketLookupResult?.purchaseId) {
      setTicketWhatsappError("Compra nao localizada para este ingresso.");
      setTicketWhatsappSuccess(null);
      return;
    }

    const phoneNumber = ticketWhatsappPhone.replace(/\D+/g, "");

    if (phoneNumber.length < 11) {
      setTicketWhatsappError("Informe o telefone com DDD para enviar no WhatsApp.");
      setTicketWhatsappSuccess(null);
      return;
    }

    setSendingTicketWhatsapp(true);
    setTicketWhatsappError(null);
    setTicketWhatsappSuccess(null);

    try {
      const response = await fetch(
        `/api/painel/bilheteria/vouchers/${ticketLookupResult.voucherId}/whatsapp`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            purchaseId: ticketLookupResult.purchaseId,
            phoneNumber,
            actor: {
              name: actorName,
              cpf: actorCpf,
            },
          }),
        },
      );
      const payload = await readJson<{
        ok: boolean;
        data?: {
          message?: string;
        };
        error?: {
          message?: string;
        };
      }>(response);

      if (!response.ok || !payload?.ok) {
        setTicketWhatsappError(
          payload?.error?.message || "Nao foi possivel enviar este ingresso agora.",
        );
        return;
      }

      setTicketWhatsappSuccess(
        payload.data?.message || "Ingresso enviado por WhatsApp com sucesso.",
      );
    } finally {
      setSendingTicketWhatsapp(false);
    }
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          {contract.forms
            ?.filter((form) => form.id !== "trip-validation")
            .map((form) => {
            const field = form.fields[0];
            const isVoucher = form.id === "voucher-validation";
            const isCustomer = form.id === "customer-validation";
            const value = isVoucher ? voucherNumber : customerDocument;
            const setValue = isVoucher ? setVoucherNumber : setCustomerDocument;
            const submitting = isVoucher ? submittingVoucher : submittingCustomer;
            const onSubmit = isCustomer ? handleCustomerSubmit : handleVoucherSubmit;

            return (
              <article key={form.id} className="panel-section px-7 py-8">
                <form
                  onSubmit={(event) => void onSubmit(event)}
                  className="grid gap-5 md:grid-cols-[80px_minmax(0,1fr)]"
                >
                  <div className="flex h-18 w-18 items-center justify-center rounded-[8px] bg-[#f1f7f0]">
                    <WorkstationFormIcon formId={form.id} />
                  </div>

                  <div>
                    <h2 className="text-[22px] font-black leading-tight text-[#17351f]">
                      {form.title}
                    </h2>

                    <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_136px]">
                      <input
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                        placeholder={field?.placeholder || field?.label}
                        className="estancia-field min-h-[56px] rounded-[6px] px-4 text-base"
                      />
                      <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex min-h-[56px] items-center justify-center rounded-[6px] border border-[#3b7e40] bg-white px-5 text-base font-bold text-[#275330] transition hover:bg-[#f7fbf5] disabled:opacity-60"
                      >
                        {submitting ? "Aguarde" : form.submitLabel}
                      </button>
                    </div>

                    <p className="mt-3 text-sm text-[#667c6a]">
                      {form.id === "voucher-validation"
                        ? "Digite o codigo do voucher para validar."
                        : "Digite o RG ou CPF do cliente para consultar."}
                    </p>
                  </div>
                </form>
              </article>
            );
          })}
        </div>

        <aside className="panel-section p-6">
          <p className="panel-eyebrow">
            Ações
          </p>
          <div className="mt-5 grid gap-3">
            {contract.header.actions
              ?.filter(
                (action) =>
                  (!action.managerOnly || isManager) && action.key !== "back-to-panel",
              )
              .map((action) => (
                action.key === "ticket-lookup" ? (
                  <button
                    key={action.key}
                    type="button"
                    onClick={handleOpenTicketLookup}
                    className={`inline-flex min-h-[58px] items-center justify-between rounded-[6px] px-5 py-3 text-left text-[15px] font-bold shadow-[0_8px_22px_rgba(24,67,34,0.05)] ${
                      actionButtonClasses(ticketLookupOpen)
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <WorkstationActionIcon actionKey={action.key} />
                      <span>{action.label}</span>
                    </span>
                    <span aria-hidden="true" className="text-xl leading-none">{">"}</span>
                  </button>
                ) : (
                  <Link
                    key={action.key}
                    href={action.href}
                    className={`inline-flex min-h-[58px] items-center justify-between rounded-[6px] px-5 py-3 text-left text-[15px] font-bold shadow-[0_8px_22px_rgba(24,67,34,0.05)] ${
                      actionButtonClasses(false)
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <WorkstationActionIcon actionKey={action.key} />
                      <span>{action.label}</span>
                    </span>
                    <span aria-hidden="true" className="text-xl leading-none">{">"}</span>
                  </Link>
                )
              ))}
          </div>

          <div className="mt-6 border-t border-[#dbe7d7] pt-4 text-sm leading-6 text-[#5a6b5d]">
            <div className="font-semibold text-[#17351f]">
              {actorName || actorCpf || "Sessão operacional"}
            </div>
          </div>
        </aside>
      </section>

      {message ? (
        <section
          className={`rounded-[10px] border px-5 py-4 text-sm ${messageToneClasses(message.tone)}`}
        >
          <p>{message.text}</p>
          {message.warnings?.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {message.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="painel-bilheteria-ticket-lookup-title"
        className={`fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,34,53,0.48)] px-4 py-6 transition ${
          ticketLookupOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="w-full max-w-[460px] rounded-[28px] border border-[#dbe7d7] bg-white shadow-[0_24px_64px_rgba(24,67,34,0.2)]">
          <div className="flex items-center justify-between gap-3 border-b border-[#dbe7d7] px-5 py-4">
            <h2
              id="painel-bilheteria-ticket-lookup-title"
              className="text-lg font-black text-[#17351f]"
            >
              {contract.modals?.find((modal) => modal.id === "ticket-lookup")?.title ||
                "Consultar Ingresso"}
            </h2>
            <button
              type="button"
              onClick={handleCloseTicketLookup}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#dbe7d7] text-[#5d745f]"
              aria-label="Fechar consulta de ingresso"
            >
              ×
            </button>
          </div>

          <div className="grid gap-4 px-5 py-5">
            <form onSubmit={handleTicketLookupSubmit} className="grid gap-3">
              <label className="grid gap-2 text-sm font-semibold text-[#35503b]">
                Inserir ID do Ingresso
                <input
                  value={ticketLookup}
                  onChange={(event) => {
                    setTicketLookup(event.target.value);
                    setTicketLookupError(null);
                    setTicketWhatsappError(null);
                    setTicketWhatsappSuccess(null);
                  }}
                  placeholder="ID do Ingresso"
                  className="estancia-field min-h-[42px] px-4 py-2.5 text-sm"
                />
              </label>

              {ticketLookupError ? (
                <div className="rounded-[14px] border border-[#ebccd1] bg-[#f2dede] px-4 py-3 text-sm text-[#a94442]">
                  {ticketLookupError}
                </div>
              ) : null}

              {ticketLookupResult ? (
                <div className="rounded-[22px] border border-[#dbe7d7] bg-[#f7fbf5] px-4 py-4 text-sm text-[#35503b]">
                  <div className="text-base font-semibold text-[#286445]">
                    Ingresso Encontrado!
                  </div>
                  <p className="mt-3">
                    Data da Compra:{" "}
                    <strong>
                      {formatPainelBilheteriaDate(ticketLookupResult.purchaseDate)}
                    </strong>
                  </p>
                  {ticketLookupResult.usedDate ? (
                    <p className="mt-2">
                      Data de Uso:{" "}
                      <strong>
                        {formatPainelBilheteriaDate(ticketLookupResult.usedDate)}
                      </strong>
                    </p>
                  ) : null}
                  {ticketLookupResult.used ? (
                    <p className="mt-3 text-[#8a6100]">
                      Este ingresso ja foi utilizado. Reemissao e envio estao bloqueados.
                    </p>
                  ) : ticketLookupResult.purchaseId ? (
                    <div className="mt-4 grid gap-3">
                      <label className="grid gap-2 text-sm font-semibold text-[#35503b]">
                        Telefone com DDD
                        <input
                          value={ticketWhatsappPhone}
                          onChange={(event) => setTicketWhatsappPhone(event.target.value)}
                          placeholder="(DDD) 9xxxx-xxxx"
                          className="estancia-field min-h-[42px] px-4 py-2.5 text-sm"
                        />
                      </label>
                      {ticketWhatsappError ? (
                        <p className="text-sm text-[#a94442]">{ticketWhatsappError}</p>
                      ) : null}
                      {ticketWhatsappSuccess ? (
                        <p className="text-sm text-[#286445]">{ticketWhatsappSuccess}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleCloseTicketLookup}
                  className="rounded-full border border-[#dbe7d7] px-4 py-2.5 text-sm font-bold text-[#5d745f]"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-[#2b8c46] px-4 py-2.5 text-sm font-bold text-white"
                >
                  {contract.modals?.find((modal) => modal.id === "ticket-lookup")
                    ?.primaryActionLabel || "Procurar"}
                </button>
                <button
                  type="button"
                  onClick={handlePrintTicketLookup}
                  disabled={!ticketLookupResult || ticketLookupResult.used}
                  className="rounded-full border border-[#dbe7d7] bg-white px-4 py-2.5 text-sm font-bold text-[#275330] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Imprimir QR-Code
                </button>
                <button
                  type="button"
                  onClick={() => void handleSendTicketLookupWhatsapp()}
                  disabled={
                    sendingTicketWhatsapp ||
                    !ticketLookupResult ||
                    ticketLookupResult.used ||
                    !ticketLookupResult.purchaseId
                  }
                  className="rounded-full bg-[#2b8c46] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sendingTicketWhatsapp ? "Enviando..." : "Enviar no WhatsApp"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {customerLookup ? (
        <section className="rounded-[28px] border border-[#dbe7d7] bg-white p-5 shadow-[0_16px_36px_rgba(24,67,34,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-[#205a7f]">
                Resultado do cliente
              </h2>
              <p className="mt-2 text-sm text-[#5d7282]">
                {customerLookup.customer?.name || "Cliente não identificado"} •{" "}
                {customerLookup.customer?.cpfLabel || "-"}
              </p>
            </div>
            <div className="text-sm text-[#5d7282]">
              Consulta por {customerLookup.documentKind.toUpperCase()}
            </div>
          </div>

          {customerLookup.purchases.length === 0 ? (
            <p className="mt-5 text-sm text-[#5d7282]">
              Nenhuma compra concluida encontrada para este documento.
            </p>
          ) : (
            <div className="mt-5 grid gap-4">
              {customerLookup.purchases.map((purchase) => (
                <article
                  key={purchase.purchaseId}
                  className="rounded-[18px] border border-[#d9e3eb] bg-[#f8fbfd] p-4"
                >
                  {(() => {
                    const purchaseVoucherIds = purchase.vouchers.map((voucher) => voucher.voucherId);
                    const selectedVoucherIds = selectedCustomerVouchers[purchase.purchaseId] ?? [];
                    const allSelected =
                      purchaseVoucherIds.length > 0 &&
                      selectedVoucherIds.length === purchaseVoucherIds.length;

                    return (
                      <>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-lg font-semibold text-[#205a7f]">
                              Compra #{purchase.purchaseId}
                            </div>
                            <div className="mt-1 text-sm text-[#5d7282]">
                              {formatPainelBilheteriaDate(purchase.purchaseDate)} •{" "}
                              {purchase.purchaseTypeLabel} • {purchase.statusLabel}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-[#205a7f]">
                              {purchase.totalValue}
                            </div>
                            <div className="text-xs text-[#5d7282]">
                              {purchase.paymentLabel}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 overflow-x-auto">
                          <table className="min-w-full border-collapse border border-[#d2dde6] text-sm">
                            <thead className="bg-[#5f84a3] text-left text-white">
                              <tr>
                                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                                  <label className="inline-flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={allSelected}
                                      onChange={() =>
                                        updateSelectedPurchaseVouchers(
                                          purchase.purchaseId,
                                          allSelected ? [] : purchaseVoucherIds,
                                        )
                                      }
                                    />
                                    <span>Todos</span>
                                  </label>
                                </th>
                                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">ID</th>
                                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Voucher</th>
                                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Data da visita</th>
                                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Passaporte</th>
                                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Valor</th>
                                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {purchase.vouchers.map((voucher) => (
                                <tr
                                  key={voucher.voucherId}
                                  className="bg-white"
                                >
                                  <td className="border border-[#d2dde6] px-4 py-3">
                                    <input
                                      type="checkbox"
                                      checked={selectedVoucherIds.includes(voucher.voucherId)}
                                      onChange={() =>
                                        toggleSelectedPurchaseVoucher(
                                          purchase.purchaseId,
                                          voucher.voucherId,
                                        )
                                      }
                                    />
                                  </td>
                                  <td className="border border-[#d2dde6] px-4 py-3">
                                    {voucher.voucherId}
                                  </td>
                                  <td className="border border-[#d2dde6] px-4 py-3 font-semibold text-[#205a7f]">
                                    {voucher.voucherNumber || `#${voucher.voucherId}`}
                                  </td>
                                  <td className="border border-[#d2dde6] px-4 py-3">
                                    {formatPainelBilheteriaDate(voucher.visitDate)}
                                  </td>
                                  <td className="border border-[#d2dde6] px-4 py-3">{voucher.voucherTypeLabel}</td>
                                  <td className="border border-[#d2dde6] px-4 py-3">{voucher.unitValue}</td>
                                  <td className="border border-[#d2dde6] px-4 py-3">{voucher.statusLabel}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void handleValidateSelectedPurchase(
                                  purchase.purchaseId,
                                  selectedVoucherIds,
                                )
                              }
                              disabled={isActionRunning(`validate-purchase-${purchase.purchaseId}`)}
                              className="rounded-[4px] bg-[linear-gradient(180deg,#3e9ce1_0%,#245f88_100%)] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                            >
                              Validar selecionados
                            </button>
                            {isManager ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleUnvalidateSelectedPurchase(
                                    purchase.purchaseId,
                                    selectedVoucherIds,
                                  )
                                }
                                disabled={isActionRunning(`unvalidate-purchase-${purchase.purchaseId}`)}
                                className="rounded-[4px] border border-[#c9d8e3] bg-white px-4 py-2 text-xs font-bold text-[#205a7f] disabled:opacity-60"
                              >
                                Desvalidar selecionados
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => handlePrintSelectedPurchase(selectedVoucherIds)}
                              className="rounded-[4px] border border-[#c9d8e3] bg-white px-4 py-2 text-xs font-bold text-[#205a7f]"
                            >
                              Imprimir selecionados
                            </button>
                            {purchase.purchaseTypeCode === "reser" ? (
                              <Link
                                href={`/painel/bilheteria/pagar-reserva/${purchase.purchaseId}`}
                                className="rounded-[4px] border border-[#c9d8e3] bg-white px-4 py-2 text-xs font-bold text-[#205a7f]"
                              >
                                Pagar reserva
                              </Link>
                            ) : null}
                          </div>

                          <div className="grid gap-2">
                            <input
                              value={purchaseWhatsappPhones[purchase.purchaseId] ?? ""}
                              onChange={(event) =>
                                setPurchaseWhatsappPhones((current) => ({
                                  ...current,
                                  [purchase.purchaseId]: event.target.value,
                                }))
                              }
                              placeholder="Telefone com DDD"
                              className="min-h-[42px] border border-[#c9d8e3] bg-white px-4 py-2.5 text-sm text-[#1b3447]"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                void handleSendSelectedPurchaseWhatsapp(
                                  purchase.purchaseId,
                                  selectedVoucherIds,
                                )
                              }
                              disabled={isActionRunning(`whatsapp-purchase-${purchase.purchaseId}`)}
                              className="rounded-[4px] bg-[#2f9e5b] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                            >
                              Enviar selecionados no WhatsApp
                            </button>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
