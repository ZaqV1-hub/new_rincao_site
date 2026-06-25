"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OpsClientTripListResult } from "@/lib/ops-client-trips";

type PainelClientTripsManagerProps = {
  data: OpsClientTripListResult;
  actorName?: string | null;
  actorCpf?: string | null;
  successMessage?: string | null;
};

function formatDateFilter(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function buildLegacyQuery(params: Record<string, string | number | null | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") {
      continue;
    }

    searchParams.set(key, String(value));
  }

  return searchParams.toString();
}

function paginationWindow(page: number, pageCount: number) {
  const start = Math.max(1, page - 2);
  const end = Math.min(pageCount, start + 4);
  const pages: number[] = [];

  for (let current = start; current <= end; current += 1) {
    pages.push(current);
  }

  return pages;
}

export function PainelClientTripsManager({
  data,
  actorName,
  actorCpf,
  successMessage,
}: PainelClientTripsManagerProps) {
  const router = useRouter();
  const [pendingAgendaId, setPendingAgendaId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const pages = useMemo(
    () => paginationWindow(data.page, data.pageCount),
    [data.page, data.pageCount],
  );
  const queryBase = useMemo(
    () => ({
      codescoladata: data.filters.code,
      q: data.filters.query,
      idtipo: data.filters.typeId,
      status: data.filters.status,
      de: formatDateFilter(data.filters.fromDate),
      ate: formatDateFilter(data.filters.toDate),
      per: data.pageSize,
    }),
    [data.filters, data.pageSize],
  );

  async function handleUnlink(agendaId: number, clientId: number) {
    if (!window.confirm("Deseja realmente desvincular este passeio do cliente selecionado?")) {
      return;
    }

    setPendingAgendaId(agendaId);
    setErrorMessage(null);
    setCopiedMessage(null);

    try {
      const response = await fetch(`/api/painel/clientes/passeios/${agendaId}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          clientId,
          actor: {
            name: actorName ?? null,
            cpf: actorCpf ?? null,
          },
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
          payload?.error?.message ||
            "Nao foi possivel desvincular o passeio agora.",
        );
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Nao foi possivel desvincular o passeio agora.",
      );
    } finally {
      setPendingAgendaId(null);
    }
  }

  async function handleCopyLink(link: string) {
    setErrorMessage(null);

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = link;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopiedMessage(`Link copiado: ${link}`);
    } catch {
      setErrorMessage("Erro ao gerar link.");
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
          <Link className="text-[#1d68a2] underline" href="/painel/clientes">
            Cliente
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <span>Passeios</span>
        </div>
      </section>

      {successMessage ? (
        <div className="border border-[#cfe8bf] bg-[#f3ffeb] px-4 py-3 text-sm text-[#3f6e1d]">
          {successMessage}
        </div>
      ) : null}

      {copiedMessage ? (
        <div className="border border-[#d0def6] bg-[#eff6ff] px-4 py-3 text-sm text-[#1d4f91]">
          {copiedMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="border border-[#efc0c0] bg-[#fff0f0] px-4 py-3 text-sm text-[#7a2b2b]">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="grid gap-5">
          {data.total === 0 ? (
            <section className="rounded-[6px] bg-white px-4 py-10 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
              <h2 className="text-[28px] text-[#3f3f3f]">
                Nao foi encontrado nenhum passeio
              </h2>
            </section>
          ) : (
            <>
              <section className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
                <div className="values m-0">
                  <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <li className="border border-[#d7d7d7] bg-[#f8fbfd] px-4 py-4 text-center">
                      <strong className="block text-[28px] text-[#205a7f]">
                        {data.indicators.performed}
                      </strong>
                      <span className="text-sm text-[#5d7282]">Realizados</span>
                    </li>
                    <li className="border border-[#d7d7d7] bg-[#f8fbfd] px-4 py-4 text-center">
                      <strong className="block text-[28px] text-[#205a7f]">
                        {data.indicators.upcoming}
                      </strong>
                      <span className="text-sm text-[#5d7282]">Futuros</span>
                    </li>
                    <li className="border border-[#d7d7d7] bg-[#f8fbfd] px-4 py-4 text-center">
                      <strong className="block text-[28px] text-[#205a7f]">
                        {data.indicators.total}
                      </strong>
                      <span className="text-sm text-[#5d7282]">Total</span>
                    </li>
                  </ul>
                </div>
                <p className="mt-3 text-[12px] text-[#6d7c89]">
                  *Indicadores a partir do ano atual
                </p>
              </section>

              <section className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-[15px]">
                    <thead className="bg-[#5f84a3] text-left text-white">
                      <tr>
                        <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                          Codigo Passeio
                        </th>
                        <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                          Cliente
                        </th>
                        <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                          Tipo de Cliente
                        </th>
                        <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                          Data
                        </th>
                        <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                          Status
                        </th>
                        <th className="border border-[#6f8ea8] px-4 py-3 text-center font-normal">
                          Qtd Pessoas
                        </th>
                        <th className="border border-[#6f8ea8] px-4 py-3 text-center font-normal">
                          Acoes
                        </th>
                        <th className="border border-[#6f8ea8] px-4 py-3 text-center font-normal">
                          Link Compra Participante
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((item, index) => (
                        <tr
                          className={index % 2 === 1 ? "bg-[#fafafa]" : "bg-white"}
                          key={`${item.agendaId}-${item.clientId}`}
                        >
                          <td className="border border-[#d7d7d7] px-4 py-3">
                            {item.code}
                          </td>
                          <td className="border border-[#d7d7d7] px-4 py-3">
                            <Link
                              className="text-[#1868d6] underline"
                              href={`/painel/clientes/editar?id=${item.clientId}`}
                            >
                              {item.clientName}
                            </Link>
                          </td>
                          <td className="border border-[#d7d7d7] px-4 py-3">
                            {item.clientTypeName || "-"}
                          </td>
                          <td className="border border-[#d7d7d7] px-4 py-3">
                            {item.dateLabel}
                          </td>
                          <td className="border border-[#d7d7d7] px-4 py-3">
                            {item.statusLabel}
                          </td>
                          <td className="border border-[#d7d7d7] px-4 py-3 text-center">
                            {item.peopleCount}
                          </td>
                          <td className="border border-[#d7d7d7] px-4 py-3 text-center">
                            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                              <Link
                                className="text-[#1868d6] underline"
                                href={`/painel/clientes/passeios/${item.agendaId}/alunos?clientId=${item.clientId}`}
                              >
                                Detalhe
                              </Link>
                              <span>|</span>
                              <Link
                                className="text-[#1868d6] underline"
                                href={`/painel/clientes/passeios/${item.agendaId}/editar?clientId=${item.clientId}`}
                              >
                                Editar
                              </Link>
                              <span>|</span>
                              <button
                                className="text-[#b53a2d] underline"
                                disabled={isPending && pendingAgendaId === item.agendaId}
                                onClick={() => void handleUnlink(item.agendaId, item.clientId)}
                                type="button"
                              >
                                {isPending && pendingAgendaId === item.agendaId
                                  ? "Desvinculando..."
                                  : "Desvincular"}
                              </button>
                            </div>
                          </td>
                          <td className="border border-[#d7d7d7] px-4 py-3 text-center">
                            {item.purchaseLink ? (
                              <button
                                className="border border-[#c6d2db] bg-[#f9fbfd] px-3 py-1.5 text-sm text-[#345062]"
                                onClick={() => void handleCopyLink(item.purchaseLink!)}
                                type="button"
                              >
                                Copiar link
                              </button>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {data.pageCount > 1 ? (
                  <nav className="mt-5 flex flex-wrap items-center gap-2 text-sm text-[#4f6476]">
                    {data.page > 1 ? (
                      <Link
                        className="border border-[#d7d7d7] px-3 py-1.5"
                        href={`/painel/clientes/passeios?${buildLegacyQuery({
                          ...queryBase,
                          page: data.page - 1,
                        })}`}
                      >
                        &lt;
                      </Link>
                    ) : null}

                    {pages.map((pageNumber) => (
                      <Link
                        className={
                          pageNumber === data.page
                            ? "border border-[#5f84a3] bg-[#5f84a3] px-3 py-1.5 text-white"
                            : "border border-[#d7d7d7] px-3 py-1.5"
                        }
                        href={`/painel/clientes/passeios?${buildLegacyQuery({
                          ...queryBase,
                          page: pageNumber,
                        })}`}
                        key={pageNumber}
                      >
                        {pageNumber}
                      </Link>
                    ))}

                    {data.page < data.pageCount ? (
                      <Link
                        className="border border-[#d7d7d7] px-3 py-1.5"
                        href={`/painel/clientes/passeios?${buildLegacyQuery({
                          ...queryBase,
                          page: data.page + 1,
                        })}`}
                      >
                        &gt;
                      </Link>
                    ) : null}
                  </nav>
                ) : null}
              </section>
            </>
          )}
        </section>

        <aside className="grid gap-5 self-start">
          <section className="rounded-[6px] bg-white px-6 py-5 shadow-[0_10px_28px_rgba(26,61,94,0.08)]">
            <div className="grid gap-4 text-[18px] text-[#757575]">
              <Link
                className="text-[#6d6d6d] underline underline-offset-2"
                href="/painel/clientes/passeios/adicionar"
              >
                Adicionar passeio
              </Link>
            </div>
          </section>

          <section className="rounded-[6px] bg-white shadow-[0_10px_28px_rgba(26,61,94,0.08)]">
            <div className="border-b border-[#d7d7d7] bg-[#efefef] px-6 py-4 text-[22px] text-[#666]">
              Filtrar
            </div>
            <form action="/painel/clientes/passeios" className="grid gap-5 px-6 py-5" method="get">
              <label className="grid gap-2 text-[18px] font-bold text-[#555]">
                <span>Codigo</span>
                <input
                  className="h-12 border border-[#d7d7d7] px-3 text-[16px] font-normal"
                  defaultValue={data.filters.code}
                  name="codescoladata"
                />
              </label>

              <label className="grid gap-2 text-[18px] font-bold text-[#555]">
                <span>Busca</span>
                <input
                  className="h-12 border border-[#d7d7d7] px-3 text-[16px] font-normal"
                  defaultValue={data.filters.query}
                  name="q"
                />
              </label>

              <label className="grid gap-2 text-[18px] font-bold text-[#555]">
                <span>Tipo</span>
                <select
                  className="h-12 border border-[#d7d7d7] px-3 text-[16px] font-normal"
                  defaultValue={data.filters.typeId == null ? "" : String(data.filters.typeId)}
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

              <label className="grid gap-2 text-[18px] font-bold text-[#555]">
                <span>Status</span>
                <select
                  className="h-12 border border-[#d7d7d7] px-3 text-[16px] font-normal"
                  defaultValue={data.filters.status}
                  name="status"
                >
                  <option value="">Todos</option>
                  <option value="abe">Aberta</option>
                  <option value="enc">Encerrada</option>
                  <option value="can">Cancelada</option>
                  <option value="fec">Fechada</option>
                </select>
              </label>

              <label className="grid gap-2 text-[18px] font-bold text-[#555]">
                <span>Data inicial</span>
                <input
                  className="h-12 border border-[#d7d7d7] px-3 text-[16px] font-normal"
                  defaultValue={formatDateFilter(data.filters.fromDate)}
                  name="de"
                  placeholder="dd/mm/aaaa"
                />
              </label>

              <label className="grid gap-2 text-[18px] font-bold text-[#555]">
                <span>Data final</span>
                <input
                  className="h-12 border border-[#d7d7d7] px-3 text-[16px] font-normal"
                  defaultValue={formatDateFilter(data.filters.toDate)}
                  name="ate"
                  placeholder="dd/mm/aaaa"
                />
              </label>

              <input name="per" type="hidden" value={data.pageSize} />

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  className="border border-[#c0c0c0] bg-[#8e8e8e] px-9 py-3 text-[18px] text-white"
                  type="submit"
                >
                  Filtrar
                </button>
                <Link
                  className="text-sm text-[#1868d6] underline"
                  href="/painel/clientes/passeios"
                >
                  Remover Filtros
                </Link>
              </div>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}
