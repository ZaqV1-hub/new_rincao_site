import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PainelBilheteriaHistoryEditor } from "@/components/painel-bilheteria-history-editor";
import { PainelBilheteriaPageHeader } from "@/components/painel-bilheteria-page-header";
import { PainelBilheteriaPurchaseDetail } from "@/components/painel-bilheteria-purchase-detail";
import {
  getPainelBilheteriaPaymentOptions,
  getPainelBilheteriaPurchaseDetail,
  listPainelBilheteriaHistory,
} from "@/lib/painel-bilheteria";
import {
  formatPainelBilheteriaCpf,
  formatPainelBilheteriaMoney,
} from "@/lib/painel-bilheteria-format";
import { readPainelBilheteriaFlashState } from "@/lib/painel-bilheteria-page";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Historico de Vendas | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

function buildHistoryHref(
  baseQuery: URLSearchParams,
  patch: Record<string, string | null | undefined>,
) {
  const params = new URLSearchParams(baseQuery.toString());

  for (const [key, value] of Object.entries(patch)) {
    if (value == null || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }

  const query = params.toString();

  return query ? `/painel/bilheteria/historico?${query}` : "/painel/bilheteria/historico";
}

export default async function PainelBilheteriaHistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{
    idcompra?: string;
    cpf?: string;
    valor?: string;
    dtini?: string;
    dtfim?: string;
    tipo?: string;
    page?: string;
    purchase?: string;
    mode?: string;
    success?: string;
    warning?: string | string[];
  }>;
}) {
  const session = await requirePainelAccess(
    ["vis_bilhet", "vis_compra"],
    "/painel/bilheteria/historico",
  );

  if (session.legacyRoleId !== 1) {
    redirect("/painel/bilheteria");
  }

  const params = await searchParams;
  const history = await listPainelBilheteriaHistory({
    purchaseId: params.idcompra,
    cpf: params.cpf,
    value: params.valor,
    dateFrom: params.dtini,
    dateTo: params.dtfim,
    type:
      params.tipo === "bilhe" || params.tipo === "reser" ? params.tipo : null,
    page: params.page,
    pageSize: 30,
  });
  const { flashSuccess, flashWarnings } = readPainelBilheteriaFlashState(params);
  const selectedPurchaseId = Number(params.purchase ?? 0);
  const selectedMode = params.mode === "edit" ? "edit" : "detail";
  const selectedDetail =
    Number.isInteger(selectedPurchaseId) && selectedPurchaseId > 0
      ? await getPainelBilheteriaPurchaseDetail(selectedPurchaseId)
      : null;

  const baseQuery = new URLSearchParams();

  if (history.filters.purchaseId) {
    baseQuery.set("idcompra", history.filters.purchaseId);
  }
  if (history.filters.cpf) {
    baseQuery.set("cpf", history.filters.cpf);
  }
  if (history.filters.value) {
    baseQuery.set("valor", history.filters.value);
  }
  if (history.filters.dateFrom) {
    baseQuery.set("dtini", history.filters.dateFrom);
  }
  if (history.filters.dateTo) {
    baseQuery.set("dtfim", history.filters.dateTo);
  }
  if (history.filters.type) {
    baseQuery.set("tipo", history.filters.type);
  }
  if (history.page > 1) {
    baseQuery.set("page", String(history.page));
  }

  const listHref = buildHistoryHref(baseQuery, {
    purchase: null,
    mode: null,
    success: null,
    warning: null,
  });
  const detailHref =
    selectedDetail != null
      ? buildHistoryHref(baseQuery, {
          purchase: String(selectedDetail.purchaseId),
          mode: null,
          success: null,
          warning: null,
        })
      : null;
  const editHref =
    selectedDetail != null
      ? buildHistoryHref(baseQuery, {
          purchase: String(selectedDetail.purchaseId),
          mode: "edit",
          success: null,
          warning: null,
        })
      : null;

  return (
    <div className="grid gap-5">
      <PainelBilheteriaPageHeader
        current="history"
        isManager
        title="Historico de vendas"
        description="Consulta auditável de compras de bilheteria e reservas, com filtro operacional e abertura inline de detalhe ou edição."
        actorName={session.actorName}
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-[6px] border border-[#d3dde6] bg-white p-6 shadow-[0_8px_22px_rgba(31,67,98,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#5d7282]">
                Resultado
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[#205a7f]">
                {history.total} compra(s)
              </h2>
            </div>
            <div className="text-sm text-[#5d7282]">
              Pagina {history.page} de {history.totalPages}
            </div>
          </div>

          {history.items.length === 0 ? (
            <div className="mt-5 rounded-[22px] border border-dashed border-[#c8d8e3] bg-[#f8fbfd] px-5 py-8 text-sm text-[#5d7282]">
              Nenhuma compra encontrada para os filtros informados.
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full border-collapse border border-[#d2dde6] text-sm">
                <thead className="bg-[#5f84a3] text-left text-white">
                  <tr>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Data</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">ID</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">CPF</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Valor</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Forma de pagamento</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Status</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {history.items.map((item) => {
                    const rowDetailHref = buildHistoryHref(baseQuery, {
                      purchase: String(item.purchaseId),
                      mode: null,
                      success: null,
                      warning: null,
                    });
                    const rowEditHref = buildHistoryHref(baseQuery, {
                      purchase: String(item.purchaseId),
                      mode: "edit",
                      success: null,
                      warning: null,
                    });

                    return (
                      <tr key={item.purchaseId} className="bg-white">
                        <td className="border border-[#d2dde6] px-4 py-3">{item.purchaseDate || "-"}</td>
                        <td className="border border-[#d2dde6] px-4 py-3 font-semibold text-[#205a7f]">
                          #{item.purchaseId}
                        </td>
                        <td className="border border-[#d2dde6] px-4 py-3">
                          {formatPainelBilheteriaCpf(item.cpf)}
                        </td>
                        <td className="border border-[#d2dde6] px-4 py-3">
                          {formatPainelBilheteriaMoney(item.totalValue)}
                        </td>
                        <td className="border border-[#d2dde6] px-4 py-3">{item.paymentLabels.join("; ") || "-"}</td>
                        <td className="border border-[#d2dde6] px-4 py-3">{item.statusLabel}</td>
                        <td className="border border-[#d2dde6] px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={rowDetailHref}
                              className="rounded-[4px] border border-[#cfd8e0] bg-white px-3 py-1.5 text-xs font-bold text-[#205a7f] hover:bg-[#edf5fa]"
                            >
                              Abrir
                            </Link>
                            {item.status !== "canc" ? (
                              <Link
                                href={rowEditHref}
                                className="rounded-[4px] border border-[#cfd8e0] bg-white px-3 py-1.5 text-xs font-bold text-[#205a7f] hover:bg-[#edf5fa]"
                              >
                                Editar
                              </Link>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {history.totalPages > 1 ? (
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              {history.page > 1 ? (
                <Link
                  href={buildHistoryHref(baseQuery, {
                    page: String(history.page - 1),
                    purchase: null,
                    mode: null,
                    success: null,
                    warning: null,
                  })}
                  className="rounded-full border border-[#c9d8e3] px-4 py-2 text-sm font-semibold text-[#205a7f] hover:bg-[#edf5fa]"
                >
                  Pagina anterior
                </Link>
              ) : null}
              {history.page < history.totalPages ? (
                <Link
                  href={buildHistoryHref(baseQuery, {
                    page: String(history.page + 1),
                    purchase: null,
                    mode: null,
                    success: null,
                    warning: null,
                  })}
                  className="rounded-full border border-[#c9d8e3] px-4 py-2 text-sm font-semibold text-[#205a7f] hover:bg-[#edf5fa]"
                >
                  Proxima pagina
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        <aside className="rounded-[6px] border border-[#d3dde6] bg-white shadow-[0_8px_22px_rgba(31,67,98,0.08)]">
          <div className="border-b border-[#d3dde6] bg-[#efefef] px-4 py-3 text-[26px] font-normal text-[#5d5d5d]">
            Filtrar
          </div>
          <form method="GET" className="grid gap-4 p-4">
            <label className="grid gap-2 text-sm font-semibold text-[#345062]">
              ID da compra
              <input
                name="idcompra"
                defaultValue={history.filters.purchaseId}
                className="min-h-[40px] border border-[#c9d8e3] bg-white px-4 py-2.5 text-sm text-[#1b3447]"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#345062]">
              CPF
              <input
                name="cpf"
                defaultValue={history.filters.cpf}
                className="min-h-[40px] border border-[#c9d8e3] bg-white px-4 py-2.5 text-sm text-[#1b3447]"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#345062]">
              Valor
              <input
                name="valor"
                defaultValue={history.filters.value}
                className="min-h-[40px] border border-[#c9d8e3] bg-white px-4 py-2.5 text-sm text-[#1b3447]"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#345062]">
              Data de
              <input
                type="date"
                name="dtini"
                defaultValue={history.filters.dateFrom}
                className="min-h-[40px] border border-[#c9d8e3] bg-white px-4 py-2.5 text-sm text-[#1b3447]"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#345062]">
              Ate
              <input
                type="date"
                name="dtfim"
                defaultValue={history.filters.dateTo}
                className="min-h-[40px] border border-[#c9d8e3] bg-white px-4 py-2.5 text-sm text-[#1b3447]"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#345062]">
              Tipo
              <select
                name="tipo"
                defaultValue={history.filters.type ?? ""}
                className="min-h-[40px] border border-[#c9d8e3] bg-white px-4 py-2.5 text-sm text-[#1b3447]"
              >
                <option value="">Todos</option>
                <option value="bilhe">Bilheteria</option>
                <option value="reser">Reserva</option>
              </select>
            </label>

            <button
              type="submit"
              className="mx-auto mt-2 min-h-[54px] min-w-[116px] bg-[#989898] px-6 py-3 text-sm font-semibold text-white shadow-[0_3px_0_rgba(0,0,0,0.15)]"
            >
              Filtrar
            </button>
            <Link
              href="/painel/bilheteria/historico"
              className="text-center text-sm font-semibold text-[#205a7f] hover:underline"
            >
              Limpar
            </Link>
          </form>
        </aside>
      </section>

      {selectedDetail ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(11,34,53,0.48)] px-4 py-6 lg:px-8">
          <section className="max-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-y-auto rounded-[28px] border border-[#d7e5ef] bg-[#f8fbfd] shadow-[0_24px_64px_rgba(31,67,98,0.28)]">
            <div className="sticky top-0 z-10 border-b border-[#d7e5ef] bg-[rgba(248,251,253,0.96)] px-4 py-4 backdrop-blur sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#5d7282]">
                    Historico de vendas
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#205a7f]">
                    {selectedMode === "edit"
                      ? `Editar compra #${selectedDetail.purchaseId}`
                      : `Detalhe da compra #${selectedDetail.purchaseId}`}
                  </h2>
                </div>
                <Link
                  href={listHref}
                  className="rounded-full border border-[#c9d8e3] bg-white px-4 py-2 text-sm font-semibold text-[#205a7f] hover:bg-[#edf5fa]"
                >
                  Fechar modal
                </Link>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {selectedMode === "edit" && selectedDetail.status !== "canc" ? (
                <PainelBilheteriaHistoryEditor
                  detail={selectedDetail}
                  actorName={session.actorName}
                  actorCpf={session.actorCpf}
                  paymentOptions={getPainelBilheteriaPaymentOptions()}
                  returnHref={detailHref || listHref}
                />
              ) : (
                <PainelBilheteriaPurchaseDetail
                  detail={selectedDetail}
                  actorName={session.actorName}
                  actorCpf={session.actorCpf}
                  returnHref={listHref}
                  editHref={editHref}
                  mode="history"
                  canManageHistory
                  paymentOptions={getPainelBilheteriaPaymentOptions()}
                  flashSuccess={flashSuccess}
                  flashWarnings={flashWarnings}
                />
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
