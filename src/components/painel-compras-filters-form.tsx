"use client";

import { useState, type FormEvent } from "react";
import type { PainelPurchaseListFilters } from "@/lib/painel-compras";
import {
  buildPainelCompraFilterSearchParams,
  formatPainelCompraCpfFilterInput,
} from "@/lib/painel-compras-format";

type SelectOption = {
  value: string;
  label: string;
};

function renderSelect(
  name: string,
  value: string | null,
  options: ReadonlyArray<SelectOption>,
) {
  return (
    <select
      className="rincao-field w-full rounded-[8px] px-3 py-2 text-sm"
      defaultValue={value ?? "-1"}
      name={name}
    >
      <option value="-1">Todos</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function toDateInputValue(value: string | null) {
  if (!value) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split("/");
    return `${year}-${month}-${day}`;
  }

  return "";
}

export function PainelComprasFiltersForm({
  filters,
  total,
  canRefreshPurchases,
  typeOptions,
  purchaseStatusOptions,
  paymentMethodOptions,
  gatewayStatusOptions,
}: {
  filters: PainelPurchaseListFilters;
  total: number;
  canRefreshPurchases: boolean;
  typeOptions: ReadonlyArray<SelectOption>;
  purchaseStatusOptions: ReadonlyArray<SelectOption>;
  paymentMethodOptions: ReadonlyArray<SelectOption>;
  gatewayStatusOptions: ReadonlyArray<SelectOption>;
}) {
  const [cpfValue, setCpfValue] = useState(
    formatPainelCompraCpfFilterInput(filters.cpf ?? ""),
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const params = buildPainelCompraFilterSearchParams(formData.entries());
    const query = params.toString();
    const href = query ? `/painel/compras?${query}` : "/painel/compras";

    window.location.assign(href);
  }

  return (
    <form
      action="/painel/compras"
      className="panel-section p-4"
      method="get"
      onSubmit={handleSubmit}
    >
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        <label className="grid gap-1 text-[13px] font-semibold text-[#133d63]">
          De
          <input
            className="rincao-field rounded-[8px] px-3 py-2 text-sm"
            defaultValue={toDateInputValue(filters.dateFrom ?? null)}
            name="dtcompra[de]"
            type="date"
          />
        </label>
        <label className="grid gap-1 text-[13px] font-semibold text-[#133d63]">
          AtÃ©
          <input
            className="rincao-field rounded-[8px] px-3 py-2 text-sm"
            defaultValue={toDateInputValue(filters.dateTo ?? null)}
            name="dtcompra[ate]"
            type="date"
          />
        </label>
        <label className="grid gap-1 text-[13px] font-semibold text-[#133d63]">
          ID
          <input
            className="rincao-field rounded-[8px] px-3 py-2 text-sm"
            defaultValue={filters.purchaseId ?? ""}
            inputMode="numeric"
            min={0}
            name="idcompra"
            type="text"
          />
        </label>
        <label className="grid gap-1 text-[13px] font-semibold text-[#133d63]">
          Tipo
          {renderSelect("tpcompra", filters.type, typeOptions)}
        </label>
        <label className="grid gap-1 text-[13px] font-semibold text-[#133d63]">
          Status
          {renderSelect("stcompra", filters.purchaseStatus, purchaseStatusOptions)}
        </label>
        <label className="grid gap-1 text-[13px] font-semibold text-[#133d63]">
          Forma de pgto
          {renderSelect(
            "payment",
            filters.paymentMethod ??
              (filters.gatewayPaymentMethod
                ? `gateway:${filters.gatewayPaymentMethod}`
                : filters.ticketPaymentMethod
                  ? `ticket:${filters.ticketPaymentMethod}`
                  : null),
            paymentMethodOptions,
          )}
        </label>
        <label className="grid gap-1 text-[13px] font-semibold text-[#133d63]">
          Pagamento
          {renderSelect("status", filters.gatewayStatus, gatewayStatusOptions)}
        </label>
        <label className="grid gap-1 text-[13px] font-semibold text-[#133d63]">
          CPF
          <input
            className="rincao-field rounded-[8px] px-3 py-2 text-sm"
            inputMode="numeric"
            maxLength={14}
            name="cpf"
            type="text"
            value={cpfValue}
            onChange={(event) =>
              setCpfValue(formatPainelCompraCpfFilterInput(event.target.value))
            }
          />
        </label>
        <label className="grid gap-1 text-[13px] font-semibold text-[#133d63]">
          UsuÃ¡rio
          <input
            className="rincao-field rounded-[8px] px-3 py-2 text-sm"
            defaultValue={filters.userName ?? ""}
            name="nmusuario"
            type="text"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-[#58728b]">{total} registro(s) no total</div>
        <div className="flex flex-wrap gap-2">
          {canRefreshPurchases ? (
            <span className="rounded-[8px] border border-[#d7e3ee] bg-[#f2f7fc] px-3 py-2 text-xs text-[#58728b]">
              AtualizaÃ§Ã£o manual em fase futura
            </span>
          ) : null}
          <button
            className="inline-flex items-center justify-center rounded-[8px] bg-[#133d63] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#184b79]"
            type="submit"
          >
            Filtrar
          </button>
        </div>
      </div>
    </form>
  );
}
