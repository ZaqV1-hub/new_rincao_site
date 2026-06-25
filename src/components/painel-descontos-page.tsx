"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PainelDiscountListResult } from "@/lib/painel-descontos";

type Props = {
  data: PainelDiscountListResult;
};

function buildHref(page: number) {
  return page > 1 ? `/painel/descontos?page=${page}` : "/painel/descontos";
}

export function PainelDescontosPage({ data }: Props) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleDelete(id: number) {
    if (!window.confirm("Excluir este desconto?")) {
      return;
    }

    setFeedback(null);
    setError(null);

    try {
      const response = await fetch(`/api/painel/descontos/${id}/remove`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { message?: string }; error?: { message?: string } }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || "Falha ao excluir o desconto.");
      }

      setFeedback(payload.data?.message || "Desconto excluido com sucesso.");
      startTransition(() => router.refresh());
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Falha ao excluir o desconto.",
      );
    }
  }

  const previousHref = data.page > 1 ? buildHref(data.page - 1) : null;
  const nextHref = data.page < data.pageCount ? buildHref(data.page + 1) : null;

  return (
    <section className="grid gap-3">
      <div className="panel-section p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="panel-eyebrow">Descontos</p>
            <h1 className="mt-1 text-[24px] font-black text-[#17351f]">
              Lista de descontos
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-[8px] border border-[#dbe7d7] px-3 py-2 text-xs font-semibold text-[#17351f]"
              href="/painel/categorias"
            >
              Categorias
            </Link>
            <Link
              className="rounded-[8px] bg-[#17342d] px-3 py-2 text-xs font-semibold text-white"
              href="/painel/descontos/novo"
            >
              Novo desconto
            </Link>
          </div>
        </div>
      </div>

      {feedback ? (
        <div className="rounded-[8px] border border-[#b7dfc0] bg-[#edf8f0] px-4 py-3 text-sm text-[#245336]">
          {feedback}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-[8px] border border-[#efc0c0] bg-[#fff0f0] px-4 py-3 text-sm text-[#7a2b2b]">
          {error}
        </div>
      ) : null}

      <div className="panel-section overflow-hidden p-0">
        {data.total === 0 ? (
          <div className="px-4 py-6 text-sm text-[#5f7564]">
            Nenhum desconto encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f7fbf5] text-left text-[#35503b]">
                <tr>
                  <th className="px-3 py-2.5 text-xs font-semibold">ID</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">Categoria</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">Nome</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">Aplicacao</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">Valor</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-right">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, index) => (
                  <tr
                    className={index % 2 === 1 ? "bg-[#fbfdf9]" : "bg-white"}
                    key={item.id}
                  >
                    <td className="px-3 py-3">{item.id}</td>
                    <td className="px-3 py-3">{item.typeDescription ?? "-"}</td>
                    <td className="px-3 py-3 font-semibold text-[#17351f]">{item.name}</td>
                    <td className="px-3 py-3">{item.applicationTypeLabel}</td>
                    <td className="px-3 py-3">{item.valueLabel}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          className="rounded-[8px] border border-[#dbe7d7] px-2.5 py-1 text-xs font-semibold text-[#17351f]"
                          href={`/painel/descontos/${item.id}/editar`}
                        >
                          Editar
                        </Link>
                        <button
                          className="rounded-[8px] border border-[#efc0c0] px-2.5 py-1 text-xs font-semibold text-[#a33b31]"
                          disabled={isPending}
                          onClick={() => handleDelete(item.id)}
                          type="button"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data.pageCount > 1 ? (
        <div className="flex flex-wrap justify-end gap-2">
          {previousHref ? (
            <Link
              className="rounded-[8px] border border-[#dbe7d7] px-3 py-2 text-sm font-semibold text-[#17351f]"
              href={previousHref}
            >
              Pagina anterior
            </Link>
          ) : null}
          {nextHref ? (
            <Link
              className="rounded-[8px] border border-[#dbe7d7] px-3 py-2 text-sm font-semibold text-[#17351f]"
              href={nextHref}
            >
              Proxima pagina
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
