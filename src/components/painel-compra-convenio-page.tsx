import Link from "next/link";
import type { PainelCompraConvenioResult } from "@/lib/painel-compra-convenio";

type PainelCompraConvenioPageProps = {
  result: PainelCompraConvenioResult;
};

const voucherTypeOptions = [
  { value: "norma", label: "Passaporte" },
  { value: "infan", label: "Passaporte Infantil" },
  { value: "escol", label: "Escolar" },
  { value: "isent", label: "Isento" },
];

const purchaseTypeOptions = [
  { value: "site", label: "Site" },
  { value: "parq", label: "No parque" },
  { value: "reser", label: "Reserva" },
];

const usedStatusOptions = [
  { value: "s", label: "Sim" },
  { value: "n", label: "Nao" },
];

const purchaseStatusOptions = [
  { value: "pend", label: "Em processamento" },
  { value: "conc", label: "Concluida" },
  { value: "canc", label: "Cancelada" },
];

const paymentMethodOptions = [
  { value: "1", label: "Cartao de credito" },
  { value: "2", label: "Boleto" },
  { value: "3", label: "TEF" },
  { value: "4", label: "Saldo PagSeguro" },
  { value: "5", label: "Oi Paggo" },
  { value: "7", label: "Deposito em conta" },
];

const paymentStatusOptions = [
  { value: "1", label: "Aguardando pagamento" },
  { value: "2", label: "Em analise" },
  { value: "3", label: "Paga" },
  { value: "4", label: "Disponivel" },
  { value: "5", label: "Em disputa" },
  { value: "6", label: "Devolvida" },
  { value: "7", label: "Cancelada" },
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

function buildIndexHref(filters: PainelCompraConvenioResult["filters"]) {
  const params = new URLSearchParams();

  if (filters.voucherNumber) params.set("numvoucher", filters.voucherNumber);
  if (filters.visitDateFrom) params.set("dtcompra[de]", filters.visitDateFrom);
  if (filters.visitDateTo) params.set("dtcompra[ate]", filters.visitDateTo);
  if (filters.usedDateFrom) params.set("dtuso[de]", filters.usedDateFrom);
  if (filters.usedDateTo) params.set("dtuso[ate]", filters.usedDateTo);
  if (filters.voucherType) params.set("tpvoucher", filters.voucherType);
  if (filters.purchaseType) params.set("tpcompra", filters.purchaseType);
  if (filters.usedStatus) params.set("stusado", filters.usedStatus);
  if (filters.purchaseStatus) params.set("stcompra", filters.purchaseStatus);
  if (filters.paymentMethodType) {
    params.set("paymentmethodtype", filters.paymentMethodType);
  }
  if (filters.paymentStatus) params.set("status", filters.paymentStatus);
  if (filters.agreementName) params.set("convenio", filters.agreementName);

  const query = params.toString();
  return query ? `/painel/compra-convenio?${query}` : "/painel/compra-convenio";
}

function hasFilters(filters: PainelCompraConvenioResult["filters"]) {
  return Object.values(filters).some((value) => value != null && value !== "");
}

function formatMoney(value: string) {
  return `R$ ${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0))}`;
}

export function PainelCompraConvenioPage({
  result,
}: PainelCompraConvenioPageProps) {
  const exportHref = buildIndexHref(result.filters).replace(
    "/painel/compra-convenio",
    "/api/painel/compra-convenio/export",
  );
  const filtersActive = hasFilters(result.filters);

  return (
    <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
        <div className="border-b border-[#d8d8d8] pb-3 text-sm text-[#909090]">
          <Link className="text-[#1d68a2] underline" href="/painel">
            Home
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <span>Lista de Compras Convenio</span>
        </div>

        <p className="my-6 border-t border-[#e3e8ed]" />

        {result.rows.length > 0 ? (
          <>
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              {[
                {
                  label: "Passaporte",
                  count: result.indicators.qtdnormal,
                  value: formatMoney(result.indicators.vlnormal),
                },
                {
                  label: "Passaporte Infantil",
                  count: result.indicators.qtdinfantil,
                  value: formatMoney(result.indicators.vlinfantil),
                },
                {
                  label: "Escolar",
                  count: result.indicators.qtdescola,
                  value: formatMoney(result.indicators.vlescola),
                },
                {
                  label: "Isento",
                  count: result.indicators.qtdisento,
                  value: "-",
                },
                {
                  label: "Total",
                  count: result.indicators.totalCount,
                  value: `R$ ${result.indicators.totalValue}`,
                },
                {
                  label: "Convenio",
                  count: result.indicators.qtdconvenio,
                  value: formatMoney(result.indicators.vlconvenio),
                },
              ].map((card) => (
                <div
                  className="rounded-[4px] border border-[#d7d7d7] bg-[#f8fbfd] px-4 py-4 text-center"
                  key={card.label}
                >
                  <strong className="block text-[28px] leading-none text-[#205a7f]">
                    {card.count}
                  </strong>
                  <span className="mt-2 block text-sm text-[#505050]">{card.label}</span>
                  <span className="mt-1 block text-sm text-[#505050]">{card.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 overflow-x-auto border border-[#cfcfcf]">
              <table className="min-w-full border-collapse text-[15px]">
                <thead className="bg-[#5f84a3] text-left text-white">
                  <tr>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                      Convenios
                    </th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Passaporte</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Valor</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Passaporte Infantil</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Valor</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Escolar</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Valor</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Isento</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                      Total Ingre.
                    </th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                      Total Vl. Ingre.
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, index) => (
                    <tr
                      className={index % 2 === 1 ? "bg-[#fafafa]" : "bg-white"}
                      key={row.agreementName}
                    >
                      <td className="border border-[#d7d7d7] px-4 py-3">{row.agreementName}</td>
                      <td className="border border-[#d7d7d7] px-4 py-3">{row.adultQuantity}</td>
                      <td className="border border-[#d7d7d7] px-4 py-3">{row.adultValue}</td>
                      <td className="border border-[#d7d7d7] px-4 py-3">{row.childQuantity}</td>
                      <td className="border border-[#d7d7d7] px-4 py-3">{row.childValue}</td>
                      <td className="border border-[#d7d7d7] px-4 py-3">{row.schoolQuantity}</td>
                      <td className="border border-[#d7d7d7] px-4 py-3">{row.schoolValue}</td>
                      <td className="border border-[#d7d7d7] px-4 py-3">{row.exemptQuantity}</td>
                      <td className="border border-[#d7d7d7] px-4 py-3">{row.totalQuantity}</td>
                      <td className="border border-[#d7d7d7] px-4 py-3">{row.totalValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-[18px] text-[#5a5a5a]">Nenhuma compra de convenio encontrada.</p>
        )}
      </div>

      <aside className="grid content-start gap-5">
        <div className="rounded-[6px] border border-[#d4dde5] bg-white p-5 shadow-[0_10px_28px_rgba(26,61,94,0.08)]">
          <ul className="grid gap-3 text-sm">
            <li>
              <a className="text-[#1d68a2] underline" href={exportHref}>
                Exportar (.xls)
              </a>
            </li>
          </ul>
        </div>

        <div className="rounded-[6px] border border-[#d4dde5] bg-white p-5 shadow-[0_10px_28px_rgba(26,61,94,0.08)]">
          <h2 className="text-[30px] font-light text-[#7b7b7b]">
            Filtrar{" "}
            {filtersActive ? (
              <Link className="text-sm text-[#1d68a2] underline" href="/painel/compra-convenio">
                Remover Filtros
              </Link>
            ) : null}
          </h2>

          <form action="/painel/compra-convenio" className="mt-5 space-y-4" method="get">
            <label className="block text-sm font-semibold text-[#5a5a5a]">
              Voucher
              <input
                className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
                defaultValue={result.filters.voucherNumber ?? ""}
                name="numvoucher"
                type="text"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm font-semibold text-[#5a5a5a]">
                Visita de
                <input
                  className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
                  defaultValue={result.filters.visitDateFrom ?? ""}
                  name="dtcompra[de]"
                  type="date"
                />
              </label>
              <label className="block text-sm font-semibold text-[#5a5a5a]">
                ate
                <input
                  className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
                  defaultValue={result.filters.visitDateTo ?? ""}
                  name="dtcompra[ate]"
                  type="date"
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm font-semibold text-[#5a5a5a]">
                Data de uso de
                <input
                  className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
                  defaultValue={result.filters.usedDateFrom ?? ""}
                  name="dtuso[de]"
                  type="date"
                />
              </label>
              <label className="block text-sm font-semibold text-[#5a5a5a]">
                ate
                <input
                  className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
                  defaultValue={result.filters.usedDateTo ?? ""}
                  name="dtuso[ate]"
                  type="date"
                />
              </label>
            </div>

            <label className="block text-sm font-semibold text-[#5a5a5a]">
              Tipo Voucher
              {renderSelect("tpvoucher", result.filters.voucherType, voucherTypeOptions)}
            </label>

            <label className="block text-sm font-semibold text-[#5a5a5a]">
              Tipo Compra
              {renderSelect("tpcompra", result.filters.purchaseType, purchaseTypeOptions)}
            </label>

            <label className="block text-sm font-semibold text-[#5a5a5a]">
              Usado?
              {renderSelect("stusado", result.filters.usedStatus, usedStatusOptions)}
            </label>

            <label className="block text-sm font-semibold text-[#5a5a5a]">
              Status
              {renderSelect("stcompra", result.filters.purchaseStatus, purchaseStatusOptions)}
            </label>

            <label className="block text-sm font-semibold text-[#5a5a5a]">
              Forma Pagamento
              {renderSelect(
                "paymentmethodtype",
                result.filters.paymentMethodType,
                paymentMethodOptions,
              )}
            </label>

            <label className="block text-sm font-semibold text-[#5a5a5a]">
              Pagamento
              {renderSelect("status", result.filters.paymentStatus, paymentStatusOptions)}
            </label>

            <label className="block text-sm font-semibold text-[#5a5a5a]">
              Tipo de Convenio
              <select
                className="w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
                defaultValue={result.filters.agreementName ?? ""}
                name="convenio"
              >
                <option value="">Todos</option>
                {result.agreementOptions.map((option) => (
                  <option key={option.name} value={option.name}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="inline-flex items-center justify-center bg-[#9a9a9a] px-6 py-3 text-sm font-semibold text-white hover:bg-[#8a8a8a]"
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
