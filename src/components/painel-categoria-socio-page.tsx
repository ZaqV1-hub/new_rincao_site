"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PainelAdminBreadcrumb } from "@/components/painel-admin-breadcrumb";
import { PainelAdminSidebar } from "@/components/painel-admin-sidebar";
import type { PainelCategoriaSocioListResult } from "@/lib/painel-categoria-socio";

type PainelCategoriaSocioPageProps = {
  data: PainelCategoriaSocioListResult;
  legacyResources: readonly string[];
};

function buildListHref(
  filters: PainelCategoriaSocioListResult["filters"],
  page: number,
  per: number,
) {
  const searchParams = new URLSearchParams();
  if (filters.idtabpreco) {
    searchParams.set("idtabpreco", filters.idtabpreco);
  }
  if (page > 1) {
    searchParams.set("page", String(page));
  }
  if (per !== 30) {
    searchParams.set("per", String(per));
  }
  const query = searchParams.toString();
  return query ? `/painel/categoria-socio?${query}` : "/painel/categoria-socio";
}

export function PainelCategoriaSocioPage({
  data,
  legacyResources,
}: PainelCategoriaSocioPageProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const previousHref = useMemo(() => {
    if (data.page <= 1) {
      return null;
    }
    return buildListHref(data.filters, data.page - 1, data.per);
  }, [data.filters, data.page, data.per]);

  const nextHref = useMemo(() => {
    if (data.page >= data.pageCount) {
      return null;
    }
    return buildListHref(data.filters, data.page + 1, data.per);
  }, [data.filters, data.page, data.pageCount, data.per]);

  async function handleRemove(id: number, name: string) {
    if (!window.confirm(`Deseja realmente remover a categoria ${name}?`)) {
      return;
    }
    setPendingId(id);
    setFeedback(null);
    try {
      const response = await fetch(`/api/painel/categoria-socio/${id}/remove`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            data?: { message?: string };
            error?: { message?: string };
          }
        | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || "Falha ao remover a categoria.");
      }
      setFeedback({
        tone: "success",
        message: payload.data?.message || "Categoria removida com sucesso.",
      });
      startTransition(() => router.refresh());
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Falha ao remover a categoria.",
      });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
        <PainelAdminBreadcrumb
          items={[
            { href: "/painel", label: "Home" },
            { href: "/painel/administrativo", label: "Administrativo" },
            { label: "Categoria Socio" },
          ]}
        />

        {feedback ? (
          <div
            className={`mt-4 border px-4 py-3 text-sm ${
              feedback.tone === "success"
                ? "border-[#b7dfc0] bg-[#edf8f0] text-[#245336]"
                : "border-[#efc0c0] bg-[#fff0f0] text-[#7a2b2b]"
            }`}
          >
            {feedback.message}
          </div>
        ) : null}

        <div className="mt-7 grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0">
            {data.total > 0 ? (
              <p className="mb-4 text-[17px] text-[#5a5a5a]">
                Mostrando <strong>{data.start}</strong>-<strong>{data.end}</strong> de{" "}
                <strong>{data.total}</strong>
              </p>
            ) : (
              <p className="mb-4 text-[17px] text-[#5a5a5a]">
                Nenhuma categoria encontrada.
              </p>
            )}

            <div className="overflow-x-auto border border-[#cfcfcf]">
              <table className="min-w-full border-collapse text-[15px]">
                <thead className="bg-[#5f84a3] text-left text-white">
                  <tr>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Nome</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Tabela de Preco</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.length > 0 ? (
                    data.items.map((item, index) => {
                      const rowTone = index % 2 === 1 ? "bg-[#fafafa]" : "bg-white";
                      const isBusy = pendingId === item.id;
                      return (
                        <tr className={rowTone} key={item.id}>
                          <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                            <Link
                              className="text-[#1868d6] underline"
                              href={`/painel/categoria-socio/${item.id}`}
                            >
                              {item.name}
                            </Link>
                          </td>
                          <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                            {item.priceTableName || "-"}
                          </td>
                          <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                            <div className="flex flex-wrap items-center gap-3 text-sm">
                              <Link
                                className="text-[#1868d6] underline"
                                href={`/painel/categoria-socio/${item.id}/editar`}
                              >
                                Editar
                              </Link>
                              <button
                                className="text-[#c2271a] underline"
                                disabled={isBusy || isPending}
                                onClick={() => handleRemove(item.id, item.name)}
                                type="button"
                              >
                                Remover
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        className="border border-[#d7d7d7] px-4 py-8 text-center text-[#6f6f6f]"
                        colSpan={3}
                      >
                        Nao ha dados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-[#5a5a5a]">
              <span>
                Pagina {data.page} de {data.pageCount}
              </span>
              <div className="flex items-center gap-2">
                {previousHref ? (
                  <Link className="border border-[#cfcfcf] px-3 py-2" href={previousHref}>
                    Anterior
                  </Link>
                ) : (
                  <span className="border border-[#e2e2e2] px-3 py-2 text-[#afafaf]">
                    Anterior
                  </span>
                )}
                {nextHref ? (
                  <Link className="border border-[#cfcfcf] px-3 py-2" href={nextHref}>
                    Proxima
                  </Link>
                ) : (
                  <span className="border border-[#e2e2e2] px-3 py-2 text-[#afafaf]">
                    Proxima
                  </span>
                )}
              </div>
            </div>
          </section>

          <aside className="grid gap-5 self-start">
            <section className="rounded-[6px] border border-[#d7e1e8] bg-white shadow-[0_10px_28px_rgba(26,61,94,0.08)]">
              <div className="grid gap-3 px-6 py-5 text-[17px] text-[#5a5a5a]">
                <Link className="text-[#666] underline" href="/painel/categoria-socio/adicionar">
                  Adicionar categoria de socio
                </Link>
              </div>
            </section>

            <section className="rounded-[6px] border border-[#d7e1e8] bg-white shadow-[0_10px_28px_rgba(26,61,94,0.08)]">
              <div className="border-b border-[#d7e1e8] bg-[#f4f4f4] px-6 py-3 text-[20px] text-[#666]">
                Filtrar
              </div>
              <form action="/painel/categoria-socio" className="grid gap-5 px-6 py-5" method="get">
                <label className="grid gap-2 text-sm font-semibold text-[#5a5a5a]">
                  Tabela de Preco
                  <select
                    className="border border-[#d3dbe3] px-3 py-3 text-base font-normal"
                    defaultValue={data.filters.idtabpreco || ""}
                    name="idtabpreco"
                  >
                    <option value="">Todos</option>
                    {data.priceTableOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="justify-self-center bg-[#9b9b9b] px-8 py-4 text-base text-white"
                  type="submit"
                >
                  Filtrar
                </button>
              </form>
            </section>

            <PainelAdminSidebar
              currentHref="/painel/categoria-socio"
              legacyResources={legacyResources}
            />
          </aside>
        </div>
      </section>
    </div>
  );
}
