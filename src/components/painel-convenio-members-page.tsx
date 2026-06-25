"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { PainelConvenioMembersListResult } from "@/lib/painel-convenio-members";

type PainelConvenioMembersPageProps = {
  data: PainelConvenioMembersListResult;
};

function buildMembersHref(data: PainelConvenioMembersListResult, page: number) {
  const params = new URLSearchParams();

  if (data.filters.cpf) {
    params.set("cpf", data.filters.cpf);
  }

  if (data.filters.status) {
    params.set("stconveniado", data.filters.status);
  }

  if (data.filters.periodFrom) {
    params.set("periodo[de]", data.filters.periodFrom);
  }

  if (data.filters.periodTo) {
    params.set("periodo[ate]", data.filters.periodTo);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  if (data.perPage !== 10) {
    params.set("pp", String(data.perPage));
  }

  const query = params.toString();
  const base = `/painel/convenios/${data.agreementId}/conveniados`;
  return query ? `${base}?${query}` : base;
}

export function PainelConvenioMembersPage({ data }: PainelConvenioMembersPageProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const previousHref = useMemo(() => {
    if (data.page <= 1) {
      return null;
    }
    return buildMembersHref(data, data.page - 1);
  }, [data]);

  const nextHref = useMemo(() => {
    if (data.page >= data.pageCount) {
      return null;
    }
    return buildMembersHref(data, data.page + 1);
  }, [data]);

  async function handleToggleStatus(memberId: string, nextStatus: "ati" | "ina") {
    setPendingMemberId(memberId);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/painel/convenios/${data.agreementId}/conveniados/${memberId}/status`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ status: nextStatus }),
        },
      );

      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            data?: { message?: string };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error?.message || "Falha ao alterar o status do conveniado.",
        );
      }

      setFeedback({
        tone: "success",
        message: payload.data?.message || "Status do conveniado atualizado.",
      });
      startTransition(() => router.refresh());
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Falha ao alterar o status do conveniado.",
      });
    } finally {
      setPendingMemberId(null);
    }
  }

  async function handleRemove(memberId: string, label: string) {
    if (!window.confirm(`Deseja realmente remover o conveniado ${label}?`)) {
      return;
    }

    setPendingMemberId(memberId);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/painel/convenios/${data.agreementId}/conveniados/${memberId}/remove`,
        {
          method: "DELETE",
          credentials: "same-origin",
        },
      );

      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            data?: { message?: string };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error?.message || "Falha ao excluir o conveniado.",
        );
      }

      setFeedback({
        tone: "success",
        message: payload.data?.message || "Conveniado excluido com sucesso.",
      });
      startTransition(() => router.refresh());
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Falha ao excluir o conveniado.",
      });
    } finally {
      setPendingMemberId(null);
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
          <Link
            className="text-[#1d68a2] underline"
            href={`/painel/convenios/${data.agreementId}`}
          >
            {data.agreementName ?? `Convenio #${data.agreementId}`}
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <span>Lista de conveniados</span>
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
            <p className="mb-4 text-[17px] text-[#5a5a5a]">Nenhum conveniado encontrado.</p>
          )}

          {data.total > 0 ? (
            <div className="overflow-x-auto border border-[#cfcfcf]">
              <table className="min-w-full border-collapse text-[15px]">
                <thead className="bg-[#5f84a3] text-left text-white">
                  <tr>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">CPF</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                      Usuario
                    </th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                      Numero de dependentes
                    </th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                      Data Inicio
                    </th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Data Fim</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Status</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, index) => {
                    const rowTone = index % 2 === 1 ? "bg-[#fafafa]" : "bg-white";
                    const nextStatus = item.statusCode === "ati" ? "ina" : "ati";
                    const actionLabel = item.statusCode === "ati" ? "Desativar" : "Ativar";
                    const isBusy = pendingMemberId === item.cpf;

                    return (
                      <tr className={rowTone} key={item.cpf}>
                        <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                          <Link
                            className="text-[#1868d6] underline"
                            href={`/painel/convenios/${data.agreementId}/conveniados/${item.cpf}`}
                          >
                            {item.cpfLabel}
                          </Link>
                        </td>
                        <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                          {item.userName ?? "-"}
                        </td>
                        <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                          {item.dailyPurchaseLimit}
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
                            onClick={() => handleToggleStatus(item.cpf, nextStatus)}
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
                              href={`/painel/convenios/${data.agreementId}/conveniados/${item.cpf}/editar`}
                            >
                              Editar
                            </Link>
                            <button
                              className="text-[#c53f3f] underline"
                              disabled={isBusy || isPending}
                              onClick={() => handleRemove(item.cpf, item.cpfLabel)}
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
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#6f7f8d]">
          Convenio
        </h2>
        <ul className="mt-3 space-y-3 text-[15px]">
          <li>
            <Link
              className="text-[#1d68a2] underline"
              href={`/painel/convenios/${data.agreementId}`}
            >
              Ver os detalhes
            </Link>
          </li>
        </ul>

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-[0.12em] text-[#6f7f8d]">
          Conveniado
        </h2>
        <ul className="mt-3 space-y-3 text-[15px]">
          <li>
            <Link
              className="text-[#1d68a2] underline"
              href={`/painel/convenios/${data.agreementId}/conveniados/adicionar`}
            >
              Adicionar conveniado
            </Link>
          </li>
          <li>
            <Link
              className="text-[#1d68a2] underline"
              href={`/painel/convenios/${data.agreementId}/importacao`}
            >
              Importar conveniados
            </Link>
          </li>
        </ul>

        <div className="mt-6 border border-[#d8d8d8] bg-white p-4">
          <h2 className="text-[30px] leading-none text-[#717171]">Filtrar</h2>
          <form
            action={`/painel/convenios/${data.agreementId}/conveniados`}
            className="mt-5 space-y-4"
            method="get"
          >
            <label className="block text-sm font-semibold text-[#5a5a5a]">
              CPF
              <input
                className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
                defaultValue={data.filters.cpf ?? ""}
                name="cpf"
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
                name="stconveniado"
              >
                <option value="-1">Todos</option>
                <option value="ati">Ativo</option>
                <option value="ina">Inativo</option>
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
