import Link from "next/link";
import type {
  PainelPurchaseVoucherIndicators,
  PainelPurchaseVoucherListFilters,
  PainelPurchaseVoucherListResult,
} from "@/lib/painel-compras";

type PainelCompraVouchersPageProps = {
  result: PainelPurchaseVoucherListResult;
};

const voucherTypeOptions = [
  { value: "norma", label: "Passaporte" },
  { value: "infan", label: "Passaporte Infantil" },
  { value: "isent", label: "Isento" },
  { value: "escol", label: "Escola" },
  { value: "corte", label: "Cortesia" },
  { value: "espec", label: "Ingresso Especial" },
];

const purchaseLocationOptions = [
  { value: "site", label: "Site" },
  { value: "reser", label: "Reserva" },
  { value: "parq", label: "No parque" },
];

const purchaseStatusOptions = [
  { value: "pend", label: "Em processamento" },
  { value: "conc", label: "Concluida" },
  { value: "canc", label: "Cancelada" },
];

const usedStatusOptions = [
  { value: "s", label: "Sim" },
  { value: "n", label: "Nao" },
];

function renderSelect(
  name: string,
  value: string | null,
  options: ReadonlyArray<{ value: string; label: string }>,
) {
  return (
    <select
      className="w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
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

function buildVoucherListHref(
  filters: PainelPurchaseVoucherListFilters,
  page: number,
) {
  const params = new URLSearchParams();

  if (filters.voucherId) params.set("idvoucher", filters.voucherId);
  if (filters.purchaseDateFrom) params.set("dtcompra[de]", filters.purchaseDateFrom);
  if (filters.purchaseDateTo) params.set("dtcompra[ate]", filters.purchaseDateTo);
  if (filters.usedDateFrom) params.set("dtuso[de]", filters.usedDateFrom);
  if (filters.usedDateTo) params.set("dtuso[ate]", filters.usedDateTo);
  if (filters.visitDateFrom) params.set("dtagenda[de]", filters.visitDateFrom);
  if (filters.visitDateTo) params.set("dtagenda[ate]", filters.visitDateTo);
  if (filters.voucherType) params.set("tpvoucher", filters.voucherType);
  if (filters.purchaseLocation) params.set("tpcompra", filters.purchaseLocation);
  if (filters.purchaseStatus) params.set("stcompra", filters.purchaseStatus);
  if (filters.usedStatus) params.set("stusado", filters.usedStatus);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `/painel/compras/vouchers?${query}` : "/painel/compras/vouchers";
}

function hasActiveFilters(filters: PainelPurchaseVoucherListFilters) {
  return Object.values(filters).some((value) => value != null && value !== "");
}

function indicatorCards(indicators: PainelPurchaseVoucherIndicators) {
  return [
    { label: "Passaporte SITE", count: indicators.qtdnormal_site, value: indicators.vlnormal_site },
    {
      label: "Passaporte Infantil SITE",
      count: indicators.qtdinfantil_site,
      value: indicators.vlinfantil_site,
    },
    {
      label: "Passaporte NO PARQUE",
      count: indicators.qtdnormal_parque,
      value: indicators.vlnormal_parque,
    },
    {
      label: "Passaporte Infantil NO PARQUE",
      count: indicators.qtdinfantil_parque,
      value: indicators.vlinfantil_parque,
    },
    { label: "Escolar", count: indicators.qtdescola, value: indicators.vlescola },
    {
      label: "PASSAPORTE RESERVA",
      count: indicators.qtdadulto_reserva,
      value: indicators.vladulto_reserva,
    },
    {
      label: "PASSAPORTE INFANTIL RESERVA",
      count: indicators.qtdinfantil_reserva,
      value: indicators.vlinfantil_reserva,
    },
    { label: "ESPECIAIS", count: indicators.qtespecial, value: indicators.vlespecial },
    { label: "CORTESIAS", count: indicators.qtdcortesia, value: "-" },
    { label: "Isento", count: indicators.qtdisento, value: "-" },
    { label: "Total", count: indicators.totalCount, value: indicators.totalValue },
  ];
}

export function PainelCompraVouchersPage({
  result,
}: PainelCompraVouchersPageProps) {
  const previousHref =
    result.page > 1 ? buildVoucherListHref(result.filters, result.page - 1) : null;
  const nextHref =
    result.page < result.totalPages
      ? buildVoucherListHref(result.filters, result.page + 1)
      : null;
  const filtersActive = hasActiveFilters(result.filters);
  const exportHref = buildVoucherListHref(result.filters, 1).replace(
    "/painel/compras/vouchers",
    "/api/painel/compras/vouchers/export",
  );

  return (
    <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
        <div className="border-b border-[#d8d8d8] pb-3 text-sm text-[#909090]">
          <Link className="text-[#1d68a2] underline" href="/painel">
            Home
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <Link className="text-[#1d68a2] underline" href="/painel/compras">
            Lista de compras / reservas
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <span>Vouchers</span>
        </div>

        <p className="my-6 border-t border-[#e3e8ed]" />

        {result.items.length === 0 ? (
          <h2 className="text-[24px] text-[#5a5a5a]">Nenhum voucher encontrado</h2>
        ) : (
          <>
            <div className="grid gap-3 lg:grid-cols-4 2xl:grid-cols-6">
              {indicatorCards(result.indicators).map((card) => (
                <div
                  className="rounded-[6px] border border-[#d9e3eb] bg-[#f7fbfe] px-4 py-3 text-center"
                  key={card.label}
                >
                  <strong className="block text-xl text-[#205a7f]">{card.count}</strong>
                  <span className="block text-xs uppercase tracking-[0.16em] text-[#607282]">
                    {card.label}
                  </span>
                  <span className="mt-1 block text-sm text-[#3a5568]">
                    {card.value === "-" ? "-" : `R$ ${card.value}`}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 overflow-x-auto border border-[#cfcfcf]">
              <table className="min-w-full border-collapse text-[15px]">
                <thead className="bg-[#5f84a3] text-left text-white">
                  <tr>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">ID</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Voucher</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Data Visita</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Passaporte</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((item, index) => (
                    <tr
                      className={index % 2 === 1 ? "bg-[#fafafa]" : "bg-white"}
                      key={`${item.purchaseId}-${item.voucherId}`}
                    >
                      <td className="border border-[#d7d7d7] px-4 py-3">{item.voucherId}</td>
                      <td className="border border-[#d7d7d7] px-4 py-3">
                        {item.voucherNumber ?? "-"}
                      </td>
                      <td className="border border-[#d7d7d7] px-4 py-3">{item.visitDate ?? "-"}</td>
                      <td className="border border-[#d7d7d7] px-4 py-3">{item.ticketTypeLabel}</td>
                      <td className="border border-[#d7d7d7] px-4 py-3">{item.unitValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {result.totalPages > 1 ? (
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            {previousHref ? (
              <Link
                className="rounded-full border border-[#c9d8e3] px-4 py-2 text-sm font-semibold text-[#205a7f] hover:bg-[#edf5fa]"
                href={previousHref}
              >
                Pagina anterior
              </Link>
            ) : null}
            {nextHref ? (
              <Link
                className="rounded-full border border-[#c9d8e3] px-4 py-2 text-sm font-semibold text-[#205a7f] hover:bg-[#edf5fa]"
                href={nextHref}
              >
                Proxima pagina
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <aside className="grid content-start gap-5">
        <div className="rounded-[6px] border border-[#d4dde5] bg-white p-5 shadow-[0_10px_28px_rgba(26,61,94,0.08)]">
          <h2 className="text-lg font-semibold text-[#205a7f]">Acoes</h2>
          <ul className="mt-4 grid gap-3 text-sm">
            <li>
              <a className="text-[#1d68a2] underline" href={exportHref}>
                Exportar (.xls)
              </a>
            </li>
            <li>
              <Link className="text-[#1d68a2] underline" href="/painel/compras">
                Lista de compras / reservas
              </Link>
            </li>
          </ul>
        </div>

        <div className="rounded-[6px] border border-[#d4dde5] bg-white p-5 shadow-[0_10px_28px_rgba(26,61,94,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[#205a7f]">Filtrar</h2>
            {filtersActive ? (
              <Link
                className="text-sm text-[#1d68a2] underline"
                href="/painel/compras/vouchers"
              >
                Remover Filtros
              </Link>
            ) : null}
          </div>
          <form action="/painel/compras/vouchers" className="mt-4 grid gap-4" method="get">
            <label className="grid gap-2 text-sm text-[#555]">
              <span>Voucher</span>
              <input
                className="border border-[#c8c8c8] px-3 py-2 text-sm text-[#444]"
                defaultValue={result.filters.voucherId ?? ""}
                name="idvoucher"
                type="text"
              />
            </label>

            <div className="grid gap-2">
              <label className="grid gap-2 text-sm text-[#555]">
                <span>Data da compra de</span>
                <input className="border border-[#c8c8c8] px-3 py-2 text-sm text-[#444]" defaultValue={result.filters.purchaseDateFrom ?? ""} name="dtcompra[de]" type="text" />
              </label>
              <label className="grid gap-2 text-sm text-[#555]">
                <span>Data da compra ate</span>
                <input className="border border-[#c8c8c8] px-3 py-2 text-sm text-[#444]" defaultValue={result.filters.purchaseDateTo ?? ""} name="dtcompra[ate]" type="text" />
              </label>
            </div>

            <div className="grid gap-2">
              <label className="grid gap-2 text-sm text-[#555]">
                <span>Data de uso de</span>
                <input className="border border-[#c8c8c8] px-3 py-2 text-sm text-[#444]" defaultValue={result.filters.usedDateFrom ?? ""} name="dtuso[de]" type="text" />
              </label>
              <label className="grid gap-2 text-sm text-[#555]">
                <span>Data de uso ate</span>
                <input className="border border-[#c8c8c8] px-3 py-2 text-sm text-[#444]" defaultValue={result.filters.usedDateTo ?? ""} name="dtuso[ate]" type="text" />
              </label>
            </div>

            <div className="grid gap-2">
              <label className="grid gap-2 text-sm text-[#555]">
                <span>Data de visita de</span>
                <input className="border border-[#c8c8c8] px-3 py-2 text-sm text-[#444]" defaultValue={result.filters.visitDateFrom ?? ""} name="dtagenda[de]" type="text" />
              </label>
              <label className="grid gap-2 text-sm text-[#555]">
                <span>Data de visita ate</span>
                <input className="border border-[#c8c8c8] px-3 py-2 text-sm text-[#444]" defaultValue={result.filters.visitDateTo ?? ""} name="dtagenda[ate]" type="text" />
              </label>
            </div>

            <label className="grid gap-2 text-sm text-[#555]">
              <span>Passaporte</span>
              {renderSelect("tpvoucher", result.filters.voucherType, voucherTypeOptions)}
            </label>
            <label className="grid gap-2 text-sm text-[#555]">
              <span>Onde</span>
              {renderSelect("tpcompra", result.filters.purchaseLocation, purchaseLocationOptions)}
            </label>
            <label className="grid gap-2 text-sm text-[#555]">
              <span>Status</span>
              {renderSelect("stcompra", result.filters.purchaseStatus, purchaseStatusOptions)}
            </label>
            <label className="grid gap-2 text-sm text-[#555]">
              <span>Usado?</span>
              {renderSelect("stusado", result.filters.usedStatus, usedStatusOptions)}
            </label>

            <button
              className="inline-flex items-center justify-center bg-[#8f8f8f] px-5 py-3 text-sm font-semibold text-white hover:bg-[#7c7c7c]"
              type="submit"
            >
              Filtrar
            </button>
          </form>
        </div>
      </aside>
    </section>
  );
}
