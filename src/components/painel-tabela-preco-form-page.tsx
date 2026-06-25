"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PainelAdminBreadcrumb } from "@/components/painel-admin-breadcrumb";
import { PainelAdminSidebar } from "@/components/painel-admin-sidebar";
import type {
  PainelTabelaPrecoFormValues,
  PainelTabelaPrecoItem,
} from "@/lib/painel-tabela-preco";

type PainelTabelaPrecoFormPageProps = {
  legacyResources: readonly string[];
  mode: "create" | "edit";
  table?: PainelTabelaPrecoItem;
};

export function PainelTabelaPrecoFormPage({
  legacyResources,
  mode,
  table,
}: PainelTabelaPrecoFormPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);
  const [form, setForm] = useState<PainelTabelaPrecoFormValues>({
    nmtabpreco: table?.name || "",
    vlnormal: table?.normalValue || "",
    vlinfant: table?.childValue || "",
    vlnormalbil: table?.gateNormalValue || "",
    vlinfantbil: table?.gateChildValue || "",
    sttabpreco: table?.status || "ati",
  });

  const title = mode === "create" ? "Adicionar tabela de preco" : "Editar tabela de preco";
  const submitLabel = mode === "create" ? "Cadastrar" : "Salvar";
  const destination = useMemo(
    () => (mode === "create" ? "/api/painel/tabela-preco" : `/api/painel/tabela-preco/${table?.id}`),
    [mode, table?.id],
  );
  const method = mode === "create" ? "POST" : "PATCH";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      try {
        const response = await fetch(destination, {
          method,
          credentials: "same-origin",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(form),
        });
        const payload = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              data?: { id?: number; message?: string };
              error?: { message?: string };
            }
          | null;

        if (!response.ok || !payload?.ok) {
          throw new Error(
            payload?.error?.message || "Falha ao salvar a tabela de preco.",
          );
        }

        setFeedback({
          tone: "success",
          message: payload.data?.message || "Tabela de preco salva com sucesso.",
        });
        const nextId = payload.data?.id || table?.id;
        router.replace(nextId ? `/painel/tabela-preco/${nextId}` : "/painel/tabela-preco");
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao salvar a tabela de preco.",
        });
      }
    });
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
        <PainelAdminBreadcrumb
          items={[
            { href: "/painel", label: "Home" },
            { href: "/painel/administrativo", label: "Administrativo" },
            { href: "/painel/tabela-preco", label: "Tabela de Preco" },
            { label: title },
          ]}
        />

        <div className="mt-7 grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0">
            <h1 className="text-[42px] leading-none text-[#205a7f]">{title}</h1>

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

            <form className="mt-6 grid gap-5" onSubmit={handleSubmit}>
              <div className="overflow-hidden border border-[#d7e1e8]">
                <table className="min-w-full border-collapse text-left text-[15px]">
                  <tbody>
                    {[
                      ["Nome", "nmtabpreco"],
                      ["Valor normal", "vlnormal"],
                      ["Valor infantil", "vlinfant"],
                      ["Valor normal bilheteria", "vlnormalbil"],
                      ["Valor infantil bilheteria", "vlinfantbil"],
                    ].map(([label, field]) => (
                      <tr key={field}>
                        <th className="w-[260px] border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">
                          {label}
                        </th>
                        <td className="border border-[#d7d7d7] px-4 py-3">
                          <input
                            className="w-full border border-[#d3dbe3] px-3 py-3"
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                [field]: event.target.value,
                              }))
                            }
                            required={field !== "vlnormalbil" && field !== "vlinfantbil"}
                            type="text"
                            value={form[field as keyof PainelTabelaPrecoFormValues] ?? ""}
                          />
                        </td>
                      </tr>
                    ))}
                    {mode === "edit" ? (
                      <tr>
                        <th className="w-[260px] border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">
                          Status
                        </th>
                        <td className="border border-[#d7d7d7] px-4 py-3">
                          <select
                            className="w-full border border-[#d3dbe3] px-3 py-3"
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                sttabpreco: event.target.value,
                              }))
                            }
                            value={form.sttabpreco}
                          >
                            <option value="ati">Ativo</option>
                            <option value="ina">Inativo</option>
                          </select>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-4">
                <button
                  className="bg-[#3fae2a] px-8 py-4 text-base font-semibold text-white disabled:opacity-60"
                  disabled={isPending}
                  type="submit"
                >
                  {isPending ? "Salvando..." : submitLabel}
                </button>
                <Link
                  className="border border-[#cfcfcf] px-8 py-4 text-base text-[#666]"
                  href={table ? `/painel/tabela-preco/${table.id}` : "/painel/tabela-preco"}
                >
                  Cancelar
                </Link>
              </div>
            </form>
          </section>

          <PainelAdminSidebar
            currentHref="/painel/tabela-preco"
            legacyResources={legacyResources}
          />
        </div>
      </section>
    </div>
  );
}
