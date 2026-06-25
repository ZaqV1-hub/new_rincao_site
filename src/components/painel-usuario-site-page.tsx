"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PainelAdminBreadcrumb } from "@/components/painel-admin-breadcrumb";
import { PainelAdminSidebar } from "@/components/painel-admin-sidebar";
import type { PainelUsuarioSiteListResult } from "@/lib/painel-usuario-site";

type PainelUsuarioSitePageProps = {
  data: PainelUsuarioSiteListResult;
  legacyResources: readonly string[];
};

function buildListHref(filters: PainelUsuarioSiteListResult["filters"], page: number, per: number) {
  const searchParams = new URLSearchParams();
  if (filters.nmusuario) {
    searchParams.set("nmusuario", filters.nmusuario);
  }
  if (filters.cpfusuario) {
    searchParams.set("cpfusuario", filters.cpfusuario);
  }
  if (filters.emailusuario) {
    searchParams.set("emailusuario", filters.emailusuario);
  }
  if (filters.stusuario) {
    searchParams.set("stusuario", filters.stusuario);
  }
  if (filters.dtcadastroDe) {
    searchParams.set("dtcadastro[de]", filters.dtcadastroDe);
  }
  if (filters.dtcadastroAte) {
    searchParams.set("dtcadastro[ate]", filters.dtcadastroAte);
  }
  if (page > 1) {
    searchParams.set("page", String(page));
  }
  if (per !== 30) {
    searchParams.set("per", String(per));
  }
  const query = searchParams.toString();
  return query ? `/painel/usuario-site?${query}` : "/painel/usuario-site";
}

export function PainelUsuarioSitePage({
  data,
  legacyResources,
}: PainelUsuarioSitePageProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);
  const [pendingCpf, setPendingCpf] = useState<string | null>(null);
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
    setPendingCpf(cpf);
    setFeedback(null);

    try {
      const response = await fetch(`/api/painel/usuario-site/${cpf}/status`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { message?: string }; error?: { message?: string } }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error?.message || "Falha ao alterar o status do usuario.",
        );
      }

      setFeedback({
        tone: "success",
        message: payload.data?.message || "Status do usuario atualizado com sucesso.",
      });
      startTransition(() => router.refresh());
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Falha ao alterar o status do usuario.",
      });
    } finally {
      setPendingCpf(null);
    }
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
        <PainelAdminBreadcrumb
          items={[
            { href: "/painel", label: "Home" },
            { href: "/painel/administrativo", label: "Administrativo" },
            { label: "Usuario Site" },
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
              <p className="mb-4 text-[17px] text-[#5a5a5a]">Nenhum usuario encontrado.</p>
            )}

            <div className="overflow-x-auto border border-[#cfcfcf]">
              <table className="min-w-full border-collapse text-[15px]">
                <thead className="bg-[#5f84a3] text-left text-white">
                  <tr>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Nome</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">CPF</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">E-Mail</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Data Cadastro</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.length > 0 ? (
                    data.items.map((item, index) => (
                      <tr className={index % 2 === 1 ? "bg-[#fafafa]" : "bg-white"} key={item.cpf}>
                        <td className="border border-[#d7d7d7] px-4 py-3">
                          <Link className="text-[#1868d6] underline" href={`/painel/usuario-site/${item.cpf}`}>
                            {item.name}
                          </Link>
                        </td>
                        <td className="border border-[#d7d7d7] px-4 py-3">{item.cpfLabel}</td>
                        <td className="border border-[#d7d7d7] px-4 py-3">{item.email}</td>
                        <td className="border border-[#d7d7d7] px-4 py-3">{item.createdAtLabel}</td>
                        <td className="border border-[#d7d7d7] px-4 py-3">
                          {item.statusLabel}{" "}
                          [
                          <button
                            className="text-[#1868d6] underline"
                            disabled={pendingCpf === item.cpf || isPending}
                            onClick={() => handleStatusToggle(item.cpf, item.status)}
                            type="button"
                          >
                            {item.status === "ati" ? "Desativar" : "Ativar"}
                          </button>
                          ]
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="border border-[#d7d7d7] px-4 py-8 text-center text-[#6f6f6f]" colSpan={5}>
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
                <a
                  className="text-[#666] underline"
                  href={buildListHref(data.filters, 1, data.total > 0 ? data.total : data.per).replace(
                    "/painel/usuario-site",
                    "/api/painel/usuario-site/export",
                  )}
                >
                  Exportar (.xls)
                </a>
              </div>
            </div>

            <div className="border border-[#d8d8d8] bg-white">
              <div className="border-b border-[#d8d8d8] bg-[#f3f3f3] px-5 py-3 text-[20px] text-[#666]">
                Filtrar
              </div>
              <form action="/painel/usuario-site" className="grid gap-5 px-5 py-4" method="get">
                <label className="grid gap-2 text-[15px] text-[#555]">
                  Nome
                  <input className="border border-[#d3dbe3] px-3 py-3" defaultValue={data.filters.nmusuario} name="nmusuario" type="text" />
                </label>
                <label className="grid gap-2 text-[15px] text-[#555]">
                  CPF
                  <input className="border border-[#d3dbe3] px-3 py-3" defaultValue={data.filters.cpfusuario} name="cpfusuario" type="text" />
                </label>
                <label className="grid gap-2 text-[15px] text-[#555]">
                  E-mail
                  <input className="border border-[#d3dbe3] px-3 py-3" defaultValue={data.filters.emailusuario} name="emailusuario" type="text" />
                </label>
                <label className="grid gap-2 text-[15px] text-[#555]">
                  Status
                  <select className="border border-[#d3dbe3] px-3 py-3" defaultValue={data.filters.stusuario} name="stusuario">
                    <option value="ati">Ativos</option>
                    <option value="-1">Todos</option>
                    <option value="ina">Inativos</option>
                  </select>
                </label>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                  <label className="grid gap-2 text-[15px] text-[#555]">
                    Cadastro de
                    <input className="border border-[#d3dbe3] px-3 py-3" defaultValue={data.filters.dtcadastroDe} name="dtcadastro[de]" type="date" />
                  </label>
                  <label className="grid gap-2 text-[15px] text-[#555]">
                    ate
                    <input className="border border-[#d3dbe3] px-3 py-3" defaultValue={data.filters.dtcadastroAte} name="dtcadastro[ate]" type="date" />
                  </label>
                </div>
                <button className="bg-[#8f8f8f] px-6 py-3 font-semibold text-white" type="submit">
                  Filtrar
                </button>
              </form>
            </div>

            <PainelAdminSidebar currentHref="/painel/usuario-site" legacyResources={legacyResources} />
          </aside>
        </div>
      </section>
    </div>
  );
}
