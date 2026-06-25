"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PainelAdminBreadcrumb } from "@/components/painel-admin-breadcrumb";
import { PainelAdminSidebar } from "@/components/painel-admin-sidebar";
import type { PainelSociosListResult } from "@/lib/painel-socios";

type PainelSociosPageProps = {
  data: PainelSociosListResult;
  legacyResources: readonly string[];
};

function buildListHref(filters: PainelSociosListResult["filters"], page: number, per: number) {
  const searchParams = new URLSearchParams();
  if (filters.cpf) {
    searchParams.set("cpf", filters.cpf);
  }
  if (filters.nmsocio) {
    searchParams.set("nmsocio", filters.nmsocio);
  }
  if (filters.idsociocateg) {
    searchParams.set("idsociocateg", filters.idsociocateg);
  }
  if (filters.stsocio) {
    searchParams.set("stsocio", filters.stsocio);
  }
  if (filters.periodoDe) {
    searchParams.set("periodo[de]", filters.periodoDe);
  }
  if (filters.periodoAte) {
    searchParams.set("periodo[ate]", filters.periodoAte);
  }
  if (page > 1) {
    searchParams.set("page", String(page));
  }
  if (per !== 30) {
    searchParams.set("per", String(per));
  }
  const query = searchParams.toString();
  return query ? `/painel/socio?${query}` : "/painel/socio";
}

export function PainelSociosPage({ data, legacyResources }: PainelSociosPageProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
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

  async function handleStatusToggle(cpf: string, status: "ati" | "ina") {
    const nextStatus = status === "ati" ? "ina" : "ati";
    setPendingKey(`status:${cpf}`);
    setFeedback(null);

    try {
      const response = await fetch(`/api/painel/socio/${cpf}/status`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { message?: string }; error?: { message?: string } }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || "Falha ao alterar o status do socio.");
      }

      setFeedback({
        tone: "success",
        message: payload.data?.message || "Status do socio atualizado com sucesso.",
      });
      startTransition(() => router.refresh());
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Falha ao alterar o status do socio.",
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleRemove(cpf: string, name: string) {
    if (!window.confirm(`Deseja realmente remover o socio ${name}?`)) {
      return;
    }

    setPendingKey(`remove:${cpf}`);
    setFeedback(null);

    try {
      const response = await fetch(`/api/painel/socio/${cpf}/remove`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { message?: string }; error?: { message?: string } }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || "Falha ao remover o socio.");
      }

      setFeedback({
        tone: "success",
        message: payload.data?.message || "Socio removido com sucesso.",
      });
      startTransition(() => router.refresh());
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Falha ao remover o socio.",
      });
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
        <PainelAdminBreadcrumb
          items={[
            { href: "/painel", label: "Home" },
            { href: "/painel/administrativo", label: "Administrativo" },
            { label: "Socios" },
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
              <p className="mb-4 text-[17px] text-[#5a5a5a]">Nenhum socio encontrado.</p>
            )}

            <div className="overflow-x-auto border border-[#cfcfcf]">
              <table className="min-w-full border-collapse text-[15px]">
                <thead className="bg-[#5f84a3] text-left text-white">
                  <tr>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">CPF</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Nome</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Categoria</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Data Inicio</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Data Fim</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Status</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.length > 0 ? (
                    data.items.map((item, index) => {
                      const rowTone = index % 2 === 1 ? "bg-[#fafafa]" : "bg-white";
                      const busyStatus = pendingKey === `status:${item.cpf}`;
                      const busyRemove = pendingKey === `remove:${item.cpf}`;
                      return (
                        <tr className={rowTone} key={item.cpf}>
                          <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                            <Link className="text-[#1868d6] underline" href={`/painel/socio/${item.cpf}`}>
                              {item.cpfLabel}
                            </Link>
                          </td>
                          <td className="border border-[#d7d7d7] px-4 py-3 align-top">{item.name}</td>
                          <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                            {item.categoryName}
                          </td>
                          <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                            {item.startDateLabel}
                          </td>
                          <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                            {item.endDateLabel}
                          </td>
                          <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                            {item.statusLabel}{" "}
                            [
                            <button
                              className="text-[#1868d6] underline"
                              disabled={busyStatus || isPending}
                              onClick={() => handleStatusToggle(item.cpf, item.status)}
                              type="button"
                            >
                              {item.status === "ati" ? "Desativar" : "Ativar"}
                            </button>
                            ]
                          </td>
                          <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                            <div className="flex flex-wrap items-center gap-3 text-sm">
                              <Link className="text-[#1868d6] underline" href={`/painel/socio/${item.cpf}/editar`}>
                                Editar
                              </Link>
                              <button
                                className="text-[#c2271a] underline"
                                disabled={busyRemove || isPending}
                                onClick={() => handleRemove(item.cpf, item.name)}
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
                        colSpan={7}
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
                  <span className="border border-[#e2e2e2] px-3 py-2 text-[#afafaf]">Anterior</span>
                )}
                {nextHref ? (
                  <Link className="border border-[#cfcfcf] px-3 py-2" href={nextHref}>
                    Proxima
                  </Link>
                ) : (
                  <span className="border border-[#e2e2e2] px-3 py-2 text-[#afafaf]">Proxima</span>
                )}
              </div>
            </div>
          </section>

          <aside className="space-y-5">
            <div className="border border-[#d8d8d8] bg-white">
              <div className="border-b border-[#d8d8d8] bg-[#f3f3f3] px-5 py-3 text-[20px] text-[#666]">
                Acoes
              </div>
              <div className="grid gap-3 px-5 py-4 text-[15px]">
                <Link className="text-[#666] underline" href="/painel/socio/adicionar">
                  Adicionar socio
                </Link>
              </div>
            </div>

            <div className="border border-[#d8d8d8] bg-white">
              <div className="border-b border-[#d8d8d8] bg-[#f3f3f3] px-5 py-3 text-[20px] text-[#666]">
                Filtrar
              </div>
              <form action="/painel/socio" className="grid gap-5 px-5 py-4" method="get">
                <label className="grid gap-2 text-[15px] text-[#555]">
                  CPF
                  <input
                    className="border border-[#d3dbe3] px-3 py-3"
                    defaultValue={data.filters.cpf}
                    name="cpf"
                    type="text"
                  />
                </label>

                <label className="grid gap-2 text-[15px] text-[#555]">
                  Nome
                  <input
                    className="border border-[#d3dbe3] px-3 py-3"
                    defaultValue={data.filters.nmsocio}
                    name="nmsocio"
                    type="text"
                  />
                </label>

                <label className="grid gap-2 text-[15px] text-[#555]">
                  Categoria
                  <select
                    className="border border-[#d3dbe3] px-3 py-3"
                    defaultValue={data.filters.idsociocateg}
                    name="idsociocateg"
                  >
                    <option value="">Todos</option>
                    {data.categoryOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                  <label className="grid gap-2 text-[15px] text-[#555]">
                    Periodo de
                    <input
                      className="border border-[#d3dbe3] px-3 py-3"
                      defaultValue={data.filters.periodoDe}
                      name="periodo[de]"
                      type="date"
                    />
                  </label>
                  <label className="grid gap-2 text-[15px] text-[#555]">
                    ate
                    <input
                      className="border border-[#d3dbe3] px-3 py-3"
                      defaultValue={data.filters.periodoAte}
                      name="periodo[ate]"
                      type="date"
                    />
                  </label>
                </div>

                <label className="grid gap-2 text-[15px] text-[#555]">
                  Status
                  <select
                    className="border border-[#d3dbe3] px-3 py-3"
                    defaultValue={data.filters.stsocio}
                    name="stsocio"
                  >
                    <option value="ati">Ativos</option>
                    <option value="-1">Todos</option>
                    <option value="ina">Inativos</option>
                  </select>
                </label>

                <button className="bg-[#8f8f8f] px-6 py-3 font-semibold text-white" type="submit">
                  Filtrar
                </button>
              </form>
            </div>

            <PainelAdminSidebar currentHref="/painel/socio" legacyResources={legacyResources} />
          </aside>
        </div>
      </section>
    </div>
  );
}
