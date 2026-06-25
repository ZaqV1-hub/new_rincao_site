import Link from "next/link";
import { BilheteriaCashHeader } from "@/components/bilheteria-cash-header";
import { formatBilheteriaCashDateTime } from "@/lib/bilheteria-cash-view-model";

type Props = {
  actorName?: string | null;
  history: {
    items: Array<{
      id: number;
      periodId: number | null;
      openedAt: string | null;
      closedAt: string | null;
      operator: string | null;
      totals: {
        cash: string;
        fund: string;
        overall: string;
      };
    }>;
    page: number;
    total: number;
    totalPages: number;
  };
};

function buildPageHref(page: number) {
  return page <= 1
    ? "/painel/bilheteria/fechamento-caixa/historico"
    : `/painel/bilheteria/fechamento-caixa/historico?page=${page}`;
}

export function BilheteriaCashClosureHistoryPage({
  actorName = null,
  history,
}: Props) {
  return (
    <div className="grid gap-5">
      <BilheteriaCashHeader
        actorName={actorName}
        primaryActions={[
          { href: "/painel/bilheteria/fechamento-caixa", label: "Fechamento de Caixa" },
        ]}
      />

      <section className="panel-section grid gap-5 p-5">
        <div>
          <p className="panel-eyebrow">Caixa</p>
          <h1 className="text-[28px] font-black leading-tight text-[#17351f]">
            Historico de fechamentos
          </h1>
        </div>

        <div className="overflow-hidden rounded-[8px] border border-[#dbe7d7] bg-white shadow-none">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-[#5f84a3] text-left text-white">
                <tr>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Data do fechamento</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 text-right font-normal">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {history.items.length > 0 ? (
                  history.items.map((item) => (
                    <tr key={item.id}>
                      <td className="border border-[#d2dde6] px-4 py-3">
                        <Link
                          className="font-semibold text-[#205a7f]"
                          href={`/painel/bilheteria/fechamento-caixa?fechamento_id=${item.id}`}
                        >
                          {formatBilheteriaCashDateTime(item.closedAt)}
                        </Link>
                      </td>
                      <td className="border border-[#d2dde6] px-4 py-3">
                        <div className="flex justify-end">
                          <Link
                            className="rounded-[4px] border border-[#d0dbe7] px-3 py-1.5 text-xs font-bold text-[#205a7f]"
                            href={`/painel/bilheteria/fechamento-caixa?fechamento_id=${item.id}`}
                          >
                            Visualizar
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-5 text-center text-[#5f7387]" colSpan={2}>
                      - Nenhum fechamento encontrado -
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#5f7387]">
          <div>
            {history.total} fechamento(s) encontrados. Pagina {history.page} de{" "}
            {history.totalPages}.
          </div>
          <div className="flex gap-2">
            {history.page > 1 ? (
              <Link
                className="rounded-[4px] border border-[#d0dbe7] bg-white px-3 py-2 font-bold text-[#205a7f]"
                href={buildPageHref(history.page - 1)}
              >
                Anterior
              </Link>
            ) : null}
            {history.page < history.totalPages ? (
              <Link
                className="rounded-[4px] border border-[#d0dbe7] bg-white px-3 py-2 font-bold text-[#205a7f]"
                href={buildPageHref(history.page + 1)}
              >
                Proxima
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
