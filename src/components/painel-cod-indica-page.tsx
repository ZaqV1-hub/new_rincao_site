"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { PainelCodIndicaListResult } from "@/lib/painel-cod-indica";

type Props = {
  data: PainelCodIndicaListResult;
};

function buildHref(filters: PainelCodIndicaListResult["filters"], page: number) {
  const params = new URLSearchParams();

  if (filters.codigo) {
    params.set("codindica", filters.codigo);
  }
  if (filters.representante) {
    params.set("nmrepresentante", filters.representante);
  }
  if (filters.validadeDe) {
    params.set("validade[de]", filters.validadeDe);
  }
  if (filters.validadeAte) {
    params.set("validade[ate]", filters.validadeAte);
  }
  if (filters.status) {
    params.set("stcodindica", filters.status);
  }
  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? `/painel/cod-indica?${query}` : "/painel/cod-indica";
}

export function PainelCodIndicaPage({ data }: Props) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const previousHref = useMemo(() => {
    if (data.page <= 1) {
      return null;
    }
    return buildHref(data.filters, data.page - 1);
  }, [data.filters, data.page]);

  const nextHref = useMemo(() => {
    if (data.page >= data.pageCount) {
      return null;
    }
    return buildHref(data.filters, data.page + 1);
  }, [data.filters, data.page, data.pageCount]);

  async function handleToggleStatus(codigo: string, nextStatus: "ati" | "ina") {
    setFeedback(null);
    setPendingCode(codigo);

    try {
      const response = await fetch(`/api/painel/cod-indica/${encodeURIComponent(codigo)}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ status: nextStatus }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { message?: string }; error?: { message?: string } }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || "Falha ao alterar o status.");
      }

      setFeedback({
        tone: "success",
        message: payload.data?.message || "Status atualizado com sucesso.",
      });
      startTransition(() => router.refresh());
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Falha ao alterar o status.",
      });
    } finally {
      setPendingCode(null);
    }
  }

  async function handleRemove(codigo: string) {
    if (!window.confirm(`Excluir o codigo ${codigo}?`)) {
      return;
    }

    setFeedback(null);
    setPendingCode(codigo);

    try {
      const response = await fetch(`/api/painel/cod-indica/${encodeURIComponent(codigo)}/remove`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { message?: string }; error?: { message?: string } }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || "Falha ao excluir o codigo.");
      }

      setFeedback({
        tone: "success",
        message: payload.data?.message || "Codigo removido com sucesso.",
      });
      startTransition(() => router.refresh());
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Falha ao excluir o codigo.",
      });
    } finally {
      setPendingCode(null);
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
          <span>Cod Indica</span>
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
            <p className="mb-4 text-[17px] text-[#5a5a5a]">
              Nenhum codigo de indicacao encontrado.
            </p>
          )}

          {data.total > 0 ? (
            <div className="overflow-x-auto border border-[#cfcfcf]">
              <table className="min-w-full border-collapse text-[15px]">
                <thead className="bg-[#5f84a3] text-left text-white">
                  <tr>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                      Codigo de Indicacao
                    </th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                      Representante
                    </th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Validade</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Status</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, index) => {
                    const rowTone = index % 2 === 1 ? "bg-[#fafafa]" : "bg-white";
                    const nextStatus = item.status === "ati" ? "ina" : "ati";
                    const actionLabel = item.status === "ati" ? "Desativar" : "Ativar";
                    const isBusy = pendingCode === item.codigo;

                    return (
                      <tr className={rowTone} key={item.codigo}>
                        <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                          <Link
                            className="text-[#1868d6] underline"
                            href={`/painel/cod-indica/${encodeURIComponent(item.codigo)}`}
                          >
                            {item.codigo}
                          </Link>
                        </td>
                        <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                          {item.representante}
                        </td>
                        <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                          {item.validadeLabel}
                        </td>
                        <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                          {item.statusLabel}
                        </td>
                        <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                          <div className="flex flex-wrap gap-x-2 gap-y-1">
                            <Link
                              className="text-[#1868d6] underline"
                              href={`/painel/cod-indica/${encodeURIComponent(item.codigo)}`}
                            >
                              Detalhe
                            </Link>
                            <span>|</span>
                            <Link
                              className="text-[#1868d6] underline"
                              href={`/painel/cod-indica/${encodeURIComponent(item.codigo)}/editar`}
                            >
                              Editar
                            </Link>
                            <span>|</span>
                            <button
                              className="text-[#1868d6] underline disabled:opacity-60"
                              disabled={isBusy || isPending}
                              onClick={() => handleToggleStatus(item.codigo, nextStatus)}
                              type="button"
                            >
                              {actionLabel}
                            </button>
                            <span>|</span>
                            <button
                              className="text-[#1868d6] underline disabled:opacity-60"
                              disabled={isBusy || isPending}
                              onClick={() => handleRemove(item.codigo)}
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
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              {previousHref ? (
                <Link
                  className="rounded-full border border-[#c9d8e3] px-4 py-2 text-sm font-semibold text-[#205a7f]"
                  href={previousHref}
                >
                  Pagina anterior
                </Link>
              ) : null}
              {nextHref ? (
                <Link
                  className="rounded-full border border-[#c9d8e3] px-4 py-2 text-sm font-semibold text-[#205a7f]"
                  href={nextHref}
                >
                  Proxima pagina
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <aside className="self-start rounded-[6px] border border-[#d7d7d7] bg-[#f6f7f8] p-4 shadow-[0_10px_28px_rgba(26,61,94,0.08)]">
        <ul className="space-y-3 text-[15px]">
          <li>
            <Link className="text-[#1d68a2] underline" href="/painel/cod-indica">
              Lista de codigos
            </Link>
          </li>
          <li>
            <Link className="text-[#1d68a2] underline" href="/painel/cod-indica/cadastro">
              Adicionar codigo
            </Link>
          </li>
          <li>
            <Link className="text-[#1d68a2] underline" href="/painel/cod-indica/mensagem">
              Mensagem
            </Link>
          </li>
        </ul>

        <div className="mt-6 border border-[#d3d3d3] bg-white p-4">
          <h2 className="text-[22px] text-[#666666]">Filtrar</h2>
          <form action="/painel/cod-indica" className="mt-4 space-y-4" method="get">
            <label className="block text-[15px] font-semibold text-[#5a5a5a]">
              Codigo
              <input
                className="mt-1 w-full border border-[#d7d7d7] px-3 py-2 text-sm text-[#444]"
                defaultValue={data.filters.codigo}
                name="codindica"
                type="text"
              />
            </label>
            <label className="block text-[15px] font-semibold text-[#5a5a5a]">
              Representante
              <input
                className="mt-1 w-full border border-[#d7d7d7] px-3 py-2 text-sm text-[#444]"
                defaultValue={data.filters.representante}
                name="nmrepresentante"
                type="text"
              />
            </label>
            <label className="block text-[15px] font-semibold text-[#5a5a5a]">
              Validade de
              <input
                className="mt-1 w-full border border-[#d7d7d7] px-3 py-2 text-sm text-[#444]"
                defaultValue={data.filters.validadeDe}
                name="validade[de]"
                type="date"
              />
            </label>
            <label className="block text-[15px] font-semibold text-[#5a5a5a]">
              Validade ate
              <input
                className="mt-1 w-full border border-[#d7d7d7] px-3 py-2 text-sm text-[#444]"
                defaultValue={data.filters.validadeAte}
                name="validade[ate]"
                type="date"
              />
            </label>
            <label className="block text-[15px] font-semibold text-[#5a5a5a]">
              Status
              <select
                className="mt-1 w-full border border-[#d7d7d7] px-3 py-2 text-sm text-[#444]"
                defaultValue={data.filters.status || "-1"}
                name="stcodindica"
              >
                <option value="-1">Todos</option>
                <option value="ati">Ativo</option>
                <option value="ina">Inativo</option>
              </select>
            </label>

            <button
              className="w-full bg-[#9c9c9c] px-4 py-3 text-sm font-semibold text-white"
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
