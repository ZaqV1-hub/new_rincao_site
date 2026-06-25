"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { PainelConvenioListResult } from "@/lib/painel-convenios";

type PainelConveniosPageProps = {
  data: PainelConvenioListResult;
};

function buildConveniosHref(filters: PainelConvenioListResult["filters"], page: number) {
  const params = new URLSearchParams();

  if (filters.name) {
    params.set("nmconvenio", filters.name);
  }

  if (filters.status) {
    params.set("stconvenio", filters.status);
  }

  if (filters.priceTableId) {
    params.set("idtabpreco", filters.priceTableId);
  }

  if (filters.periodFrom) {
    params.set("periodo[de]", filters.periodFrom);
  }

  if (filters.periodTo) {
    params.set("periodo[ate]", filters.periodTo);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  if (filters.perPage !== 30) {
    params.set("pp", String(filters.perPage));
  }

  const query = params.toString();
  return query ? `/painel/convenios?${query}` : "/painel/convenios";
}

function hasActiveFilters(filters: PainelConvenioListResult["filters"]) {
  return Boolean(
    filters.name ||
      filters.status ||
      filters.priceTableId ||
      filters.periodFrom ||
      filters.periodTo,
  );
}

export function PainelConveniosPage({ data }: PainelConveniosPageProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [pendingAgreementId, setPendingAgreementId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const previousHref = useMemo(() => {
    if (data.page <= 1) {
      return null;
    }
    return buildConveniosHref(data.filters, data.page - 1);
  }, [data.filters, data.page]);

  const nextHref = useMemo(() => {
    if (data.page >= data.pageCount) {
      return null;
    }
    return buildConveniosHref(data.filters, data.page + 1);
  }, [data.filters, data.page, data.pageCount]);

  async function handleToggleStatus(agreementId: number, nextStatus: "ati" | "ina") {
    setPendingAgreementId(agreementId);
    setFeedback(null);

    try {
      const response = await fetch(`/api/painel/convenios/${agreementId}/status`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            data?: { message?: string };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error?.message || "Falha ao alterar o status do convenio.",
        );
      }

      setFeedback({
        tone: "success",
        message: payload.data?.message || "Status do convenio atualizado.",
      });
      startTransition(() => router.refresh());
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Falha ao alterar o status do convenio.",
      });
    } finally {
      setPendingAgreementId(null);
    }
  }

  async function handleRemove(agreementId: number, agreementName: string) {
    if (!window.confirm(`Deseja realmente remover o convenio ${agreementName}?`)) {
      return;
    }

    setPendingAgreementId(agreementId);
    setFeedback(null);

    try {
      const response = await fetch(`/api/painel/convenios/${agreementId}/remove`, {
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
        throw new Error(payload?.error?.message || "Falha ao excluir o convenio.");
      }

      setFeedback({
        tone: "success",
        message: payload.data?.message || "Convenio removido com sucesso.",
      });
      startTransition(() => router.refresh());
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Falha ao excluir o convenio.",
      });
    } finally {
      setPendingAgreementId(null);
    }
  }

  return (
    <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
        <div className="border-b border-[#d8d8d8] pb-3 text-sm text-[#909090]">
          <Link className="text-[#1d68a2] underline" href="/painel">
            Home
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <span>Lista de convenios</span>
        </div>

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

        <div className="mt-6">
          {data.total > 0 ? (
            <p className="mb-4 text-[17px] text-[#5a5a5a]">
              Mostrando <strong>{data.start}</strong>-<strong>{data.end}</strong> de{" "}
              <strong>{data.total}</strong>
            </p>
          ) : (
            <p className="mb-4 text-[17px] text-[#5a5a5a]">Nenhum convenio encontrado.</p>
          )}

          {data.total > 0 ? (
            <div className="overflow-x-auto border border-[#cfcfcf]">
              <table className="min-w-full border-collapse text-[15px]">
                <thead className="bg-[#5f84a3] text-left text-white">
                  <tr>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">ID</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Nome</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                      Tabela de Preco
                    </th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                      Data Inicio
                    </th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                      Data Fim
                    </th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Status</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, index) => {
                    const rowTone = index % 2 === 1 ? "bg-[#fafafa]" : "bg-white";
                    const nextStatus = item.statusCode === "ati" ? "ina" : "ati";
                    const actionLabel = item.statusCode === "ati" ? "Desativar" : "Ativar";
                    const isBusy = pendingAgreementId === item.id;

                    return (
                      <tr className={rowTone} key={item.id}>
                        <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                          <Link
                            className="text-[#1868d6] underline"
                            href={`/painel/convenios/${item.id}`}
                          >
                            {item.id}
                          </Link>
                        </td>
                        <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                          <Link
                            className="text-[#1868d6] underline"
                            href={`/painel/convenios/${item.id}`}
                          >
                            {item.name}
                          </Link>
                        </td>
                        <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                          {item.priceTableName ?? "-"}
                        </td>
                        <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                          {item.startDate ?? "-"}
                        </td>
                        <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                          {item.endDate ?? "-"}
                        </td>
                        <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                          {item.statusLabel} [
                          <button
                            className="text-[#1868d6] underline"
                            disabled={isBusy || isPending}
                            onClick={() => handleToggleStatus(item.id, nextStatus)}
                            type="button"
                          >
                            {actionLabel}
                          </button>
                          ]
                        </td>
                        <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                          <div className="flex flex-wrap items-center gap-3 text-sm">
                            <Link
                              className="text-[#1868d6] underline"
                              href={`/painel/convenios/${item.id}/editar`}
                            >
                              Editar
                            </Link>
                            <button
                              className="text-[#c53f3f] underline"
                              disabled={isBusy || isPending}
                              onClick={() => handleRemove(item.id, item.name)}
                              type="button"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        {data.pageCount > 1 ? (
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

      <aside className="self-start rounded-[6px] border border-[#d7d7d7] bg-[#f6f7f8] p-4 shadow-[0_10px_28px_rgba(26,61,94,0.08)]">
        <ul className="space-y-3 text-[15px]">
          <li>
            <Link className="text-[#1d68a2] underline" href="/painel/convenios/adicionar">
              Adicionar convenio
            </Link>
          </li>
        </ul>

        <div className="mt-6 border border-[#d8d8d8] bg-white p-4">
          <h2 className="text-[30px] leading-none text-[#717171]">Filtrar</h2>
          {hasActiveFilters(data.filters) ? (
            <div className="mt-2 text-sm text-[#5a5a5a]">
              <Link className="text-[#1d68a2] underline" href="/painel/convenios">
                Remover Filtros
              </Link>
            </div>
          ) : null}

          <form action="/painel/convenios" className="mt-5 space-y-4" method="get">
            <label className="block text-sm font-semibold text-[#5a5a5a]">
              Nome
              <input
                className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
                defaultValue={data.filters.name ?? ""}
                name="nmconvenio"
                type="text"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-[#5a5a5a]">
                Periodo de
                <input
                  className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
                  defaultValue={data.filters.periodFrom ?? ""}
                  name="periodo[de]"
                  placeholder="dd/mm/aaaa"
                  type="text"
                />
              </label>
              <label className="block text-sm font-semibold text-[#5a5a5a]">
                ate
                <input
                  className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
                  defaultValue={data.filters.periodTo ?? ""}
                  name="periodo[ate]"
                  placeholder="dd/mm/aaaa"
                  type="text"
                />
              </label>
            </div>

            <label className="block text-sm font-semibold text-[#5a5a5a]">
              Status
              <select
                className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
                defaultValue={data.filters.status ?? "-1"}
                name="stconvenio"
              >
                <option value="-1">Todos</option>
                <option value="ati">Ativo</option>
                <option value="ina">Inativo</option>
              </select>
            </label>

            <label className="block text-sm font-semibold text-[#5a5a5a]">
              Tabela de Preco
              <select
                className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
                defaultValue={data.filters.priceTableId ?? "-1"}
                name="idtabpreco"
              >
                <option value="-1">Todos</option>
                {data.priceTableOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="inline-flex items-center justify-center bg-[#8a8a8a] px-6 py-3 text-sm font-semibold text-white hover:bg-[#747474]"
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
