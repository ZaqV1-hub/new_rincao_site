"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PainelComprasFiltersForm } from "@/components/painel-compras-filters-form";
import type {
  PainelPurchaseListFilters,
  PainelPurchaseListItem,
  PainelPurchaseListResult,
} from "@/lib/painel-compras";

type SelectOption = {
  value: string;
  label: string;
};

type PainelComprasPageContentProps = {
  actorCpf: string | null;
  initialFilters: PainelPurchaseListFilters;
  initialPage: number;
  typeOptions: ReadonlyArray<SelectOption>;
  purchaseStatusOptions: ReadonlyArray<SelectOption>;
  paymentMethodOptions: ReadonlyArray<SelectOption>;
  gatewayStatusOptions: ReadonlyArray<SelectOption>;
};

type PurchasesApiPayload = {
  ok?: boolean;
  data?: PainelPurchaseListResult;
  error?: {
    message?: string;
  };
};

function buildLegacyUserHref(cpf: string) {
  const normalizedCpf = cpf.replace(/\D+/g, "");
  return `/ingresso/painel/usuario-site/detalhe/cpf/${btoa(normalizedCpf)}`;
}

function buildComprasHref(filters: PainelPurchaseListFilters, page: number) {
  const params = new URLSearchParams();

  if (filters.dateFrom) {
    params.set("dtcompra[de]", filters.dateFrom);
  }

  if (filters.dateTo) {
    params.set("dtcompra[ate]", filters.dateTo);
  }

  if (filters.purchaseId) {
    params.set("idcompra", filters.purchaseId);
  }

  if (filters.type) {
    params.set("tpcompra", filters.type);
  }

  if (filters.purchaseStatus) {
    params.set("stcompra", filters.purchaseStatus);
  }

  if (filters.paymentMethod) {
    params.set("payment", filters.paymentMethod);
  } else if (filters.gatewayPaymentMethod) {
    params.set("paymentmethodtype", filters.gatewayPaymentMethod);
  } else if (filters.ticketPaymentMethod) {
    params.set("formapag", filters.ticketPaymentMethod);
  }

  if (filters.gatewayStatus) {
    params.set("status", filters.gatewayStatus);
  }

  if (filters.cpf) {
    params.set("cpf", filters.cpf);
  }

  if (filters.userName) {
    params.set("nmusuario", filters.userName);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? `/painel/compras?${query}` : "/painel/compras";
}

function buildApiHref(filters: PainelPurchaseListFilters, page: number) {
  return buildComprasHref(filters, page).replace("/painel/compras", "/api/painel/compras");
}

function createEmptyResult(
  filters: PainelPurchaseListFilters,
  page: number,
): PainelPurchaseListResult {
  return {
    items: [],
    total: 0,
    page,
    perPage: 30,
    totalPages: 1,
    filters,
  };
}

function PurchasesTable({ items }: { items: PainelPurchaseListItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-[#eef5fb] text-left text-[#36536b]">
          <tr>
            <th className="px-3 py-2.5 text-xs font-semibold">ID</th>
            <th className="px-3 py-2.5 text-xs font-semibold">Data</th>
            <th className="px-3 py-2.5 text-xs font-semibold">Tipo</th>
            <th className="px-3 py-2.5 text-xs font-semibold">Status</th>
            <th className="px-3 py-2.5 text-xs font-semibold">Forma</th>
            <th className="px-3 py-2.5 text-xs font-semibold">Pagamento</th>
            <th className="px-3 py-2.5 text-xs font-semibold">CPF</th>
            <th className="px-3 py-2.5 text-xs font-semibold">Usuário</th>
            <th className="px-3 py-2.5 text-xs font-semibold text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr
              className={index % 2 === 1 ? "bg-[#f8fbff]" : "bg-white"}
              key={item.purchaseId}
            >
              <td className="px-3 py-3 align-top font-semibold text-[#133d63]">
                <Link
                  className="underline decoration-[#7aa7cf] underline-offset-2"
                  href={`/painel/compras/${item.purchaseId}`}
                >
                  {item.purchaseId}
                </Link>
              </td>
              <td className="px-3 py-3 align-top">{item.purchaseDate ?? "-"}</td>
              <td className="px-3 py-3 align-top">{item.typeLabel}</td>
              <td className="px-3 py-3 align-top">{item.statusLabel}</td>
              <td className="px-3 py-3 align-top">{item.paymentMethodLabel}</td>
              <td className="px-3 py-3 align-top">{item.paymentLabel}</td>
              <td className="px-3 py-3 align-top">{item.cpf ?? "-"}</td>
              <td className="px-3 py-3 align-top">
                {item.userName && item.cpf ? (
                  <a
                    className="underline decoration-[#7aa7cf] underline-offset-2"
                    href={buildLegacyUserHref(item.cpf)}
                  >
                    {item.userName}
                  </a>
                ) : (
                  item.userName ?? "-"
                )}
              </td>
              <td className="px-3 py-3 align-top text-right font-semibold text-[#133d63]">
                {item.totalValue}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PainelComprasPageContent({
  actorCpf,
  initialFilters,
  initialPage,
  typeOptions,
  purchaseStatusOptions,
  paymentMethodOptions,
  gatewayStatusOptions,
}: PainelComprasPageContentProps) {
  const [result, setResult] = useState<PainelPurchaseListResult>(() =>
    createEmptyResult(initialFilters, initialPage),
  );
  const [loading, setLoading] = useState(true);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPurchases() {
      setLoading(true);
      setLoadErrorMessage(null);

      try {
        const response = await fetch(buildApiHref(initialFilters, initialPage), {
          method: "GET",
          credentials: "same-origin",
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as PurchasesApiPayload | null;

        if (!response.ok || !payload?.ok || !payload.data) {
          throw new Error(
            payload?.error?.message || "Nao foi possivel carregar a lista de compras.",
          );
        }

        setResult(payload.data);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("painel-compras-page-load-failed", error);
        setLoadErrorMessage(
          "Nao foi possivel carregar as compras com os filtros informados agora. Ajuste a busca e tente novamente.",
        );
        setResult(createEmptyResult(initialFilters, initialPage));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadPurchases();

    return () => controller.abort();
  }, [initialFilters, initialPage]);

  const canRefreshPurchases = actorCpf === "00000000191";
  const previousHref =
    result.page > 1 ? buildComprasHref(result.filters, result.page - 1) : null;
  const nextHref =
    result.page < result.totalPages
      ? buildComprasHref(result.filters, result.page + 1)
      : null;

  return (
    <>
      {loadErrorMessage ? (
        <div className="panel-section border border-[#efc0c0] bg-[#fff0f0] p-4 text-sm text-[#7a2b2b]">
          {loadErrorMessage}
        </div>
      ) : null}

      <PainelComprasFiltersForm
        filters={result.filters}
        total={result.total}
        canRefreshPurchases={canRefreshPurchases}
        typeOptions={typeOptions}
        purchaseStatusOptions={purchaseStatusOptions}
        paymentMethodOptions={paymentMethodOptions}
        gatewayStatusOptions={gatewayStatusOptions}
      />

      <div className="panel-section overflow-hidden p-0">
        {loading ? (
          <div className="px-4 py-6 text-sm text-[#58728b]">Carregando compras...</div>
        ) : result.items.length === 0 ? (
          <div className="px-4 py-6 text-sm text-[#58728b]">
            Nenhuma compra encontrada.
          </div>
        ) : (
          <PurchasesTable items={result.items} />
        )}
      </div>

      {result.totalPages > 1 ? (
        <div className="flex flex-wrap justify-end gap-2">
          {previousHref ? (
            <Link
              className="rounded-[8px] border border-[#d7e3ee] px-3 py-2 text-sm font-semibold text-[#133d63]"
              href={previousHref}
            >
              Página anterior
            </Link>
          ) : null}
          {nextHref ? (
            <Link
              className="rounded-[8px] border border-[#d7e3ee] px-3 py-2 text-sm font-semibold text-[#133d63]"
              href={nextHref}
            >
              Próxima página
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
