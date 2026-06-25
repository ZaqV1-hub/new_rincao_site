import { Buffer } from "node:buffer";
import Link from "next/link";
import type { PainelPurchaseListResult } from "@/lib/painel-compras";

type PainelComprasPageProps = {
  actorName: string | null;
  actorCpf: string | null;
  result: PainelPurchaseListResult;
};

const typeOptions = [
  { value: "bilhe", label: "Bilheteria" },
  { value: "reser", label: "Reserva" },
  { value: "ponli", label: "Compra" },
];

const purchaseStatusOptions = [
  { value: "pend", label: "Em processamento" },
  { value: "conc", label: "Concluida" },
  { value: "canc", label: "Cancelada" },
];

const gatewayPaymentMethodOptions = [
  { value: "1", label: "Cartao de credito" },
  { value: "2", label: "Boleto" },
  { value: "11", label: "Pix" },
];

const ticketPaymentMethodOptions = [
  { value: "dinhe", label: "Dinheiro" },
  { value: "debit", label: "Debito" },
  { value: "credi", label: "Credito" },
  { value: "chequ", label: "Cheque" },
  { value: "tranb", label: "Trans. Bancaria" },
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
  { value: "2", label: "Em analise" },
  { value: "3", label: "Paga" },
  { value: "4", label: "Disponivel" },
  { value: "5", label: "Em disputa" },
  { value: "6", label: "Devolvida" },
  { value: "7", label: "Cancelada" },
  { value: "8", label: "Chargeback debitado" },
  { value: "9", label: "Em contestacao" },
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

function renderSelect(
  name: string,
  value: string | null,
  options: ReadonlyArray<{ value: string; label: string }>,
) {
  return (
    <select
      className="estancia-field w-full rounded-[8px] px-3 py-2 text-sm"
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

function hasActiveFilters(filters: PainelPurchaseListResult["filters"]) {
  return Object.values(filters).some((value) => value != null && value !== "");
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

function buildLegacyUserHref(cpf: string) {
  return `/ingresso/painel/usuario-site/detalhe/cpf/${Buffer.from(
    cpf,
    "utf8",
  ).toString("base64")}`;
}

export function PainelComprasPage({
  actorName,
  actorCpf,
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
            <h1 className="mt-1 text-[24px] font-black text-[#17351f]">
              Lista de compras e reservas
            </h1>
            <p className="mt-1 text-sm text-[#5f7564]">
              Operador: {actorName || actorCpf || "Sessao operacional"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-[8px] border border-[#dbe7d7] px-3 py-2 text-xs font-semibold text-[#17351f]"
              href={exportHref}
            >
              Exportar
            </Link>
            {filtersActive ? (
              <Link
                className="rounded-[8px] border border-[#dbe7d7] px-3 py-2 text-xs font-semibold text-[#17351f]"
                href="/painel/compras"
              >
                Limpar filtros
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <form action="/painel/compras" className="panel-section p-4" method="get">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <label className="grid gap-1 text-[13px] font-semibold text-[#17351f]">
            De
            <input
              className="estancia-field rounded-[8px] px-3 py-2 text-sm"
              defaultValue={toDateInputValue(result.filters.dateFrom ?? null)}
              name="dtcompra[de]"
              type="date"
            />
          </label>
          <label className="grid gap-1 text-[13px] font-semibold text-[#17351f]">
            Ate
            <input
              className="estancia-field rounded-[8px] px-3 py-2 text-sm"
              defaultValue={toDateInputValue(result.filters.dateTo ?? null)}
              name="dtcompra[ate]"
              type="date"
            />
          </label>
          <label className="grid gap-1 text-[13px] font-semibold text-[#17351f]">
            ID
            <input
              className="estancia-field rounded-[8px] px-3 py-2 text-sm"
              defaultValue={result.filters.purchaseId ?? ""}
              min={0}
              name="idcompra"
              type="number"
            />
          </label>
          <label className="grid gap-1 text-[13px] font-semibold text-[#17351f]">
            Tipo
            {renderSelect("tpcompra", result.filters.type, typeOptions)}
          </label>
          <label className="grid gap-1 text-[13px] font-semibold text-[#17351f]">
            Status
            {renderSelect("stcompra", result.filters.purchaseStatus, purchaseStatusOptions)}
          </label>
          <label className="grid gap-1 text-[13px] font-semibold text-[#17351f]">
            Forma de pgto
            {renderSelect(
              "payment",
              result.filters.paymentMethod ??
                (result.filters.gatewayPaymentMethod
                  ? `gateway:${result.filters.gatewayPaymentMethod}`
                  : result.filters.ticketPaymentMethod
                    ? `ticket:${result.filters.ticketPaymentMethod}`
                    : null),
              paymentMethodOptions,
            )}
          </label>
          <label className="grid gap-1 text-[13px] font-semibold text-[#17351f]">
            Pagamento
            {renderSelect("status", result.filters.gatewayStatus, gatewayStatusOptions)}
          </label>
          <label className="grid gap-1 text-[13px] font-semibold text-[#17351f]">
            CPF
            <input
              className="estancia-field rounded-[8px] px-3 py-2 text-sm"
              defaultValue={result.filters.cpf ?? ""}
              name="cpf"
              type="text"
            />
          </label>
          <label className="grid gap-1 text-[13px] font-semibold text-[#17351f]">
            Usuario
            <input
              className="estancia-field rounded-[8px] px-3 py-2 text-sm"
              defaultValue={result.filters.userName ?? ""}
              name="nmusuario"
              type="text"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-[#5f7564]">
            {result.total} registro(s) no total
          </div>
          <div className="flex flex-wrap gap-2">
            {canRefreshPurchases ? (
              <span className="rounded-[8px] border border-[#dbe7d7] bg-[#f7fbf5] px-3 py-2 text-xs text-[#5f7564]">
                Atualizacao manual em fase futura
              </span>
            ) : null}
            <button
              className="estancia-button inline-flex items-center justify-center rounded-[8px] px-4 py-2 text-sm"
              type="submit"
            >
              Filtrar
            </button>
          </div>
        </div>
      </form>

      <div className="panel-section overflow-hidden p-0">
        {result.items.length === 0 ? (
          <div className="px-4 py-6 text-sm text-[#5f7564]">
            Nenhuma compra encontrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f7fbf5] text-left text-[#35503b]">
                <tr>
                  <th className="px-3 py-2.5 text-xs font-semibold">ID</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">Data</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">Tipo</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">Status</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">Forma</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">Pagamento</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">CPF</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">Usuario</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item, index) => (
                  <tr
                    className={index % 2 === 1 ? "bg-[#fbfdf9]" : "bg-white"}
                    key={item.purchaseId}
                  >
                    <td className="px-3 py-3 align-top font-semibold text-[#17351f]">
                      <Link
                        className="underline decoration-[#9bc08f] underline-offset-2"
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
                          className="underline decoration-[#9bc08f] underline-offset-2"
                          href={buildLegacyUserHref(item.cpf)}
                        >
                          {item.userName}
                        </a>
                      ) : (
                        item.userName ?? "-"
                      )}
                    </td>
                    <td className="px-3 py-3 align-top text-right font-semibold text-[#17351f]">
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
              className="rounded-[8px] border border-[#dbe7d7] px-3 py-2 text-sm font-semibold text-[#17351f]"
              href={previousHref}
            >
              Pagina anterior
            </Link>
          ) : null}
          {nextHref ? (
            <Link
              className="rounded-[8px] border border-[#dbe7d7] px-3 py-2 text-sm font-semibold text-[#17351f]"
              href={nextHref}
            >
              Proxima pagina
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
