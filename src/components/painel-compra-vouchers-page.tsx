import Link from "next/link";
import type {
  PainelPurchaseVoucherListFilters,
  PainelPurchaseVoucherListResult,
} from "@/lib/painel-compras";

type PainelCompraVouchersPageProps = {
  result: PainelPurchaseVoucherListResult;
};

const voucherTypeOptions = [
  { value: "norma", label: "Adulto" },
  { value: "infan", label: "Criança" },
  { value: "isent", label: "Isento" },
  { value: "escol", label: "Escola" },
  { value: "corte", label: "Cortesia" },
];

const purchaseLocationOptions = [
  { value: "site", label: "Site" },
  { value: "reser", label: "Reserva" },
  { value: "parq", label: "No parque" },
];

const purchaseStatusOptions = [
  { value: "pend", label: "Em processamento" },
  { value: "conc", label: "Concluída" },
  { value: "canc", label: "Cancelada" },
];

const usedStatusOptions = [
  { value: "s", label: "Sim" },
  { value: "n", label: "Não" },
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

function dateInputValue(value: string | null) {
  if (!value) return "";

  const parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  return parts ? `${parts[3]}-${parts[2]}-${parts[1]}` : value;
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
    <section className="grid gap-3">
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

        <div className="mt-6 rounded-[6px] border border-[#d4dde5] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#205a7f]">Filtrar vouchers</h2>
              <p className="mt-1 text-sm text-[#58728b]">{result.total} voucher(s) encontrado(s).</p>
            </div>
            <div className="flex gap-2">
              <a className="rounded-[8px] border border-[#d7e3ee] px-3 py-2 text-xs font-semibold text-[#133d63]" href={exportHref}>
                Exportar (.xls)
              </a>
              {filtersActive ? (
                <Link className="rounded-[8px] border border-[#d7e3ee] px-3 py-2 text-xs font-semibold text-[#133d63]" href="/painel/compras/vouchers">
                  Limpar filtros
                </Link>
              ) : null}
            </div>
          </div>
          <form action="/painel/compras/vouchers" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" method="get">
            <label className="grid gap-2 text-sm font-medium text-[#173f61]">
              <span>Voucher</span>
              <input className="min-h-11 rounded-[8px] border border-[#c8d8e8] px-3 py-2 text-sm" defaultValue={result.filters.voucherId ?? ""} name="idvoucher" type="text" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-[#173f61]">
              <span>Data da compra de</span>
              <input className="min-h-11 rounded-[8px] border border-[#c8d8e8] px-3 py-2 text-sm" defaultValue={dateInputValue(result.filters.purchaseDateFrom)} name="dtcompra[de]" type="date" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-[#173f61]">
              <span>Data da compra até</span>
              <input className="min-h-11 rounded-[8px] border border-[#c8d8e8] px-3 py-2 text-sm" defaultValue={dateInputValue(result.filters.purchaseDateTo)} name="dtcompra[ate]" type="date" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-[#173f61]">
              <span>Data de uso de</span>
              <input className="min-h-11 rounded-[8px] border border-[#c8d8e8] px-3 py-2 text-sm" defaultValue={dateInputValue(result.filters.usedDateFrom)} name="dtuso[de]" type="date" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-[#173f61]">
              <span>Data de uso até</span>
              <input className="min-h-11 rounded-[8px] border border-[#c8d8e8] px-3 py-2 text-sm" defaultValue={dateInputValue(result.filters.usedDateTo)} name="dtuso[ate]" type="date" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-[#173f61]">
              <span>Data de visita de</span>
              <input className="min-h-11 rounded-[8px] border border-[#c8d8e8] px-3 py-2 text-sm" defaultValue={dateInputValue(result.filters.visitDateFrom)} name="dtagenda[de]" type="date" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-[#173f61]">
              <span>Data de visita até</span>
              <input className="min-h-11 rounded-[8px] border border-[#c8d8e8] px-3 py-2 text-sm" defaultValue={dateInputValue(result.filters.visitDateTo)} name="dtagenda[ate]" type="date" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-[#173f61]">
              <span>Ingresso</span>
              {renderSelect("tpvoucher", result.filters.voucherType, voucherTypeOptions)}
            </label>
            <label className="grid gap-2 text-sm font-medium text-[#173f61]">
              <span>Onde</span>
              {renderSelect("tpcompra", result.filters.purchaseLocation, purchaseLocationOptions)}
            </label>
            <label className="grid gap-2 text-sm font-medium text-[#173f61]">
              <span>Status da compra</span>
              {renderSelect("stcompra", result.filters.purchaseStatus, purchaseStatusOptions)}
            </label>
            <label className="grid gap-2 text-sm font-medium text-[#173f61]">
              <span>Usado?</span>
              {renderSelect("stusado", result.filters.usedStatus, usedStatusOptions)}
            </label>
            <div className="flex items-end">
              <button className="min-h-11 rounded-[8px] bg-[#133d63] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1d5686]" type="submit">
                Filtrar
              </button>
            </div>
          </form>
        </div>

        <div className="mt-5">
        {result.items.length === 0 ? (
          <h2 className="text-[20px] text-[#5a5a5a]">Nenhum voucher encontrado</h2>
        ) : (
          <>

            <div className="mt-6 overflow-x-auto border border-[#cfcfcf]">
              <table className="min-w-full border-collapse text-[15px]">
                <thead className="bg-[#5f84a3] text-left text-white">
                  <tr>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Compra</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">ID Voucher</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Voucher</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Data Visita</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Ingresso</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((item, index) => (
                    <tr
                      className={index % 2 === 1 ? "bg-[#fafafa]" : "bg-white"}
                      key={`${item.purchaseId}-${item.voucherId}`}
                    >
                      <td className="border border-[#d7d7d7] px-4 py-3">
                        <Link
                          className="text-[#1868d6] underline"
                          href={`/painel/compras/${item.purchaseId}`}
                        >
                          {item.purchaseId}
                        </Link>
                      </td>
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
        </div>

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
                Próxima pagina
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

    </section>
  );
}
