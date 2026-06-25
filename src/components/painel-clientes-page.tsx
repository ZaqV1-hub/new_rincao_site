"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PainelClientesListResult } from "@/lib/painel-clientes";

type PainelClientesPageProps = {
  data: PainelClientesListResult;
};

function buildListHref(
  filters: PainelClientesListResult["filters"],
  page: number,
  per: number,
) {
  const searchParams = new URLSearchParams();

  if (filters.q) {
    searchParams.set("q", filters.q);
  }

  if (filters.idtipo) {
    searchParams.set("idtipo", filters.idtipo);
  }

  if (filters.status) {
    searchParams.set("status", filters.status);
  }

  if (page > 1) {
    searchParams.set("page", String(page));
  }

  if (per !== 20) {
    searchParams.set("per", String(per));
  }

  const query = searchParams.toString();
  return query ? `/painel/clientes?${query}` : "/painel/clientes";
}

export function PainelClientesPage({ data }: PainelClientesPageProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);
  const [pendingClientId, setPendingClientId] = useState<number | null>(null);
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

  async function handleToggleStatus(clientId: number) {
    setPendingClientId(clientId);
    setFeedback(null);

    try {
      const response = await fetch(`/api/painel/clientes/${clientId}/status`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reason: "Alternancia de status pela lista de clientes do painel.",
        }),
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
          payload?.error?.message || "Falha ao alterar o status do cliente.",
        );
      }

      setFeedback({
        tone: "success",
        message: payload.data?.message || "Status do cliente atualizado.",
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Falha ao alterar o status do cliente.",
      });
    } finally {
      setPendingClientId(null);
    }
  }

  async function handleDelete(clientId: number, clientName: string) {
    if (!window.confirm(`Deseja realmente remover o cliente ${clientName}?`)) {
      return;
    }

    setPendingClientId(clientId);
    setFeedback(null);

    try {
      const response = await fetch(`/api/painel/clientes/${clientId}`, {
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
        throw new Error(
          payload?.error?.message || "Falha ao excluir o cliente.",
        );
      }

      setFeedback({
        tone: "success",
        message: payload.data?.message || "Cliente excluido com sucesso.",
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Falha ao excluir o cliente.",
      });
    } finally {
      setPendingClientId(null);
    }
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
        <div className="border-b border-[#d8d8d8] pb-3 text-sm text-[#909090]">
          <Link className="text-[#1d68a2] underline" href="/painel">
            Home
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <span>Clientes</span>
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

        <div className="mt-7 grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            {data.total > 0 ? (
              <p className="mb-4 text-[17px] text-[#5a5a5a]">
                Mostrando <strong>{data.start}</strong>-<strong>{data.end}</strong> de{" "}
                <strong>{data.total}</strong>
              </p>
            ) : (
              <p className="mb-4 text-[17px] text-[#5a5a5a]">
                Nenhum cliente encontrado.
              </p>
            )}

            {data.total > 0 ? (
              <div className="overflow-x-auto border border-[#cfcfcf]">
                <table className="min-w-full border-collapse text-[15px]">
                  <thead className="bg-[#5f84a3] text-left text-white">
                    <tr>
                      <th className="border border-[#6f8ea8] px-4 py-3 font-normal">ID</th>
                      <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Nome</th>
                      <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Tipo</th>
                      <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Status</th>
                      <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item, index) => {
                      const rowTone = index % 2 === 1 ? "bg-[#fafafa]" : "bg-white";
                      const statusActionLabel = item.active ? "Desativar" : "Ativar";
                      const isBusy = pendingClientId === item.id;

                      return (
                        <tr className={rowTone} key={item.id}>
                          <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                            <Link
                              className="text-[#1868d6] underline"
                              href={`/painel/clientes/detalhe?id=${item.id}`}
                            >
                              {item.id}
                            </Link>
                          </td>
                          <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                            <Link
                              className="text-[#1868d6] underline"
                              href={`/painel/clientes/detalhe?id=${item.id}`}
                            >
                              {item.name}
                            </Link>
                          </td>
                          <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                            {item.typeName || "-"}
                          </td>
                          <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                            {item.active ? "Ativo" : "Inativo"}{" "}
                            [
                            <button
                              className="text-[#1868d6] underline"
                              disabled={isBusy || isPending}
                              onClick={() => handleToggleStatus(item.id)}
                              type="button"
                            >
                              {statusActionLabel}
                            </button>
                            ]
                          </td>
                          <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                            <div className="flex flex-wrap items-center gap-3 text-sm">
                              <Link
                                className="text-[#1868d6] underline"
                                href={`/painel/clientes/editar?id=${item.id}`}
                              >
                                Editar
                              </Link>
                              <button
                                className="text-[#b91c1c] underline"
                                disabled={isBusy || isPending}
                                onClick={() => handleDelete(item.id, item.name)}
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

            {data.pageCount > 1 ? (
              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
                {previousHref ? (
                  <Link className="text-[#1868d6] underline" href={previousHref}>
                    &lt; Anterior
                  </Link>
                ) : (
                  <span className="text-[#9d9d9d]">&lt; Anterior</span>
                )}
                <span className="text-[#5a5a5a]">
                  Pagina {data.page} de {data.pageCount}
                </span>
                {nextHref ? (
                  <Link className="text-[#1868d6] underline" href={nextHref}>
                    Proxima &gt;
                  </Link>
                ) : (
                  <span className="text-[#9d9d9d]">Proxima &gt;</span>
                )}
              </div>
            ) : null}
          </div>

          <aside className="grid content-start gap-6">
            <div className="grid gap-4 text-[17px]">
              <Link
                className="break-words text-[#6d6d6d] underline decoration-transparent transition hover:text-[#246b18]"
                href="/painel/clientes/adicionar"
              >
                + Adicionar cliente
              </Link>
              <Link
                className="break-words text-[#6d6d6d] underline decoration-transparent transition hover:text-[#205a7f]"
                href="/painel/clientes/passeios"
              >
                Passeios
              </Link>
            </div>

            <div className="border border-[#cfcfcf] bg-white">
              <div className="bg-[#ececec] px-4 py-3 text-[28px] leading-none text-[#666]">
                Filtrar
              </div>
              <form className="grid gap-5 p-4" method="get">
                <label className="grid gap-2 text-[16px] font-bold text-[#666]">
                  Busca
                  <input
                    className="h-10 border border-[#dddddd] px-3 text-[15px] font-normal text-[#333]"
                    defaultValue={data.filters.q}
                    name="q"
                  />
                </label>

                <label className="grid gap-2 text-[16px] font-bold text-[#666]">
                  Tipo
                  <select
                    className="h-10 border border-[#dddddd] px-3 text-[15px] font-normal text-[#333]"
                    defaultValue={data.filters.idtipo}
                    name="idtipo"
                  >
                    <option value="">Todos</option>
                    {data.typeOptions.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-[16px] font-bold text-[#666]">
                  Status
                  <select
                    className="h-10 border border-[#dddddd] px-3 text-[15px] font-normal text-[#333]"
                    defaultValue={data.filters.status}
                    name="status"
                  >
                    <option value="">Todos</option>
                    <option value="1">Ativo</option>
                    <option value="0">Inativo</option>
                  </select>
                </label>

                <div className="flex justify-center pt-2">
                  <button
                    className="min-w-[116px] bg-[#9a9a9a] px-8 py-4 text-[18px] text-white"
                    type="submit"
                  >
                    Filtrar
                  </button>
                </div>
              </form>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
