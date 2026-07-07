import { Buffer } from "node:buffer";
import Link from "next/link";
import { PainelComprasFiltersForm } from "@/components/painel-compras-filters-form";
import type { PainelPurchaseListResult } from "@/lib/painel-compras";

type PainelComprasPageProps = {
  actorName: string | null;
  actorCpf: string | null;
  loadErrorMessage?: string | null;
  result: PainelPurchaseListResult;
};

const typeOptions = [
  { value: "bilhe", label: "Bilheteria" },
  { value: "reser", label: "Reserva" },
  { value: "ponli", label: "Compra" },
];

const purchaseStatusOptions = [
  { value: "pend", label: "Em processamento" },
  { value: "conc", label: "Concluída" },
  { value: "canc", label: "Cancelada" },
];

const gatewayPaymentMethodOptions = [
  { value: "1", label: "Cartao de credito" },
  { value: "2", label: "Boleto" },
  { value: "11", label: "Pix" },
];

const ticketPaymentMethodOptions = [
  { value: "dinhe", label: "Dinheiro" },
  { value: "debit", label: "Débito" },
  { value: "credi", label: "Crédito" },
  { value: "chequ", label: "Cheque" },
  { value: "tranb", label: "Trans. Bancária" },
  { value: "corte", label: "Cortesia" },
  { value: "pix", label: "PIX" },
];

const paymentMethodOptions = [
  ...gatewayPaymentMethodOptions.map((option) => ({
    value: `gateway:${option.value}`,
    label: option.label,
  })),
  ...ticketPaymentMethodOptions.map((option) => ({
    value: `ticket:${option.value}`,
    label: option.label,
  })),
];

const gatewayStatusOptions = [
  { value: "1", label: "Aguardando pagamento" },
  { value: "2", label: "Em análise" },
  { value: "3", label: "Paga" },
  { value: "4", label: "Disponível" },
  { value: "5", label: "Em disputa" },
  { value: "6", label: "Devolvida" },
  { value: "7", label: "Cancelada" },
  { value: "8", label: "Chargeback debitado" },
  { value: "9", label: "Em contestação" },
];

function buildComprasHref(
  filters: PainelPurchaseListResult["filters"],
  page: number,
) {
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

function hasActiveFilters(filters: PainelPurchaseListResult["filters"]) {
  return Object.values(filters).some((value) => value != null && value !== "");
}

function buildLegacyUserHref(cpf: string) {
  const normalizedCpf = cpf.replace(/\D+/g, "");

  return `/ingresso/painel/usuario-site/detalhe/cpf/${Buffer.from(
    normalizedCpf,
    "utf8",
  ).toString("base64")}`;
}

export function PainelComprasPage({
  actorName,
  actorCpf,
  loadErrorMessage = null,
  result,
}: PainelComprasPageProps) {
  const previousHref =
    result.page > 1 ? buildComprasHref(result.filters, result.page - 1) : null;
  const nextHref =
    result.page < result.totalPages
      ? buildComprasHref(result.filters, result.page + 1)
      : null;
  const canRefreshPurchases = actorCpf === "00000000191";
  const filtersActive = hasActiveFilters(result.filters);
  const exportHref = buildComprasHref(result.filters, 1).replace(
    "/painel/compras",
    "/api/painel/compras/export",
  );

  return (
    <section className="grid gap-3">
      <div className="panel-section p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="panel-eyebrow">Compras</p>
            <h1 className="mt-1 text-[24px] font-black text-[#133d63]">
              Lista de compras e reservas
            </h1>
            <p className="mt-1 text-sm text-[#58728b]">
              Operador: {actorName || actorCpf || "Sessão operacional"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-[8px] border border-[#d7e3ee] px-3 py-2 text-xs font-semibold text-[#133d63]"
              href={exportHref}
            >
              Exportar
            </Link>
            {filtersActive ? (
              <Link
                className="rounded-[8px] border border-[#d7e3ee] px-3 py-2 text-xs font-semibold text-[#133d63]"
                href="/painel/compras"
              >
                Limpar filtros
              </Link>
            ) : null}
          </div>
        </div>
      </div>

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
        {result.items.length === 0 ? (
          <div className="px-4 py-6 text-sm text-[#58728b]">
            Nenhuma compra encontrada.
          </div>
        ) : (
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
                {result.items.map((item, index) => (
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
    </section>
  );
}
