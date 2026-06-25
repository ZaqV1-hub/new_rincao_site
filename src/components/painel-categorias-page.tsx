"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PainelDiscountTypeListResult } from "@/lib/painel-descontos";

type Props = {
  data: PainelDiscountTypeListResult;
};

function buildHref(page: number) {
  return page > 1 ? `/painel/categorias?page=${page}` : "/painel/categorias";
}

export function PainelCategoriasPage({ data }: Props) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleDelete(id: number) {
    if (!window.confirm("Excluir este tipo de desconto?")) {
      return;
    }

    setFeedback(null);
    setError(null);
    try {
      const response = await fetch(`/api/painel/categorias/${id}/remove`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { message?: string }; error?: { message?: string } }
        | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || "Falha ao excluir a categoria.");
      }
      setFeedback(payload.data?.message || "Tipo de desconto excluido com sucesso.");
      startTransition(() => router.refresh());
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Falha ao excluir a categoria.",
      );
    }
  }

  const previousHref = data.page > 1 ? buildHref(data.page - 1) : null;
  const nextHref = data.page < data.pageCount ? buildHref(data.page + 1) : null;

  return (
    <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
        <div className="border-b border-[#d8d8d8] pb-3 text-sm text-[#909090]">
          <Link className="text-[#1d68a2] underline" href="/painel">
            Home
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <span>Categorias</span>
        </div>

        <p className="my-6 border-t border-[#e3e8ed]" />

        {feedback ? (
          <div className="mb-4 border border-[#b7dfc0] bg-[#edf8f0] px-4 py-3 text-sm text-[#245336]">
            {feedback}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 border border-[#efc0c0] bg-[#fff0f0] px-4 py-3 text-sm text-[#7a2b2b]">
            {error}
          </div>
        ) : null}

        {data.total === 0 ? (
          <h2 className="text-[24px] text-[#5a5a5a]">Nenhuma categoria encontrada</h2>
        ) : (
          <>
            <div className="overflow-x-auto border border-[#cfcfcf]">
              <table className="min-w-full border-collapse text-[15px]">
                <thead className="bg-[#5f84a3] text-left text-white">
                  <tr>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">ID</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                      Descricao
                    </th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, index) => (
                    <tr
                      className={index % 2 === 1 ? "bg-[#fafafa]" : "bg-white"}
                      key={item.id}
                    >
                      <td className="border border-[#d7d7d7] px-4 py-3">{item.id}</td>
                      <td className="border border-[#d7d7d7] px-4 py-3">
                        {item.description}
                      </td>
                      <td className="border border-[#d7d7d7] px-4 py-3">
                        <Link
                          className="text-[#1868d6] underline"
                          href={`/painel/categorias/${item.id}/editar`}
                        >
                          Editar
                        </Link>{" "}
                        |{" "}
                        <button
                          className="text-[#1868d6] underline"
                          disabled={isPending}
                          onClick={() => handleDelete(item.id)}
                          type="button"
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
          </>
        )}
      </div>

      <aside className="self-start rounded-[6px] border border-[#d7d7d7] bg-[#f6f7f8] p-4 shadow-[0_10px_28px_rgba(26,61,94,0.08)]">
        <ul className="space-y-3 text-[15px]">
          <li>
            <Link className="text-[#1d68a2] underline" href="/painel/categorias">
              Lista de Categorias
            </Link>
          </li>
          <li>
            <Link className="text-[#1d68a2] underline" href="/painel/descontos">
              Lista de Descontos
            </Link>
          </li>
          <li>
            <Link className="text-[#1d68a2] underline" href="/painel/categorias/novo">
              Adicionar Categoria
            </Link>
          </li>
          <li>
            <Link className="text-[#1d68a2] underline" href="/painel/descontos/novo">
              Adicionar Desconto
            </Link>
          </li>
        </ul>
      </aside>
    </section>
  );
}
