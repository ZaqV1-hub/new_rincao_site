"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PainelAdminBreadcrumb } from "@/components/painel-admin-breadcrumb";
import { PainelAdminSidebar } from "@/components/painel-admin-sidebar";
import type {
  PainelInformacaoFormValues,
  PainelInformacaoItem,
} from "@/lib/painel-informacoes";

type PainelInformacaoFormPageProps = {
  legacyResources: readonly string[];
  mode: "create" | "edit";
  information?: PainelInformacaoItem;
};

export function PainelInformacaoFormPage({
  legacyResources,
  mode,
  information,
}: PainelInformacaoFormPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);
  const [form, setForm] = useState<PainelInformacaoFormValues>({
    nome: information?.name || "",
    texto: information?.text || "",
    status: information?.status || "ati",
  });

  const title = mode === "create" ? "Adicionar informacao" : "Editar informacao";
  const submitLabel = mode === "create" ? "Cadastrar" : "Salvar";
  const destination = useMemo(
    () => (mode === "create" ? "/api/painel/informacao" : `/api/painel/informacao/${information?.id}`),
    [mode, information?.id],
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
          throw new Error(payload?.error?.message || "Falha ao salvar a informacao.");
        }

        setFeedback({
          tone: "success",
          message: payload.data?.message || "Informacao salva com sucesso.",
        });
        const nextId = payload.data?.id || information?.id;
        router.replace(nextId ? `/painel/informacao/${nextId}` : "/painel/informacao");
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "Falha ao salvar a informacao.",
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
            { href: "/painel/informacao", label: "Informacoes" },
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
                    <tr>
                      <th className="w-[260px] border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">
                        Nome
                      </th>
                      <td className="border border-[#d7d7d7] px-4 py-3">
                        <input
                          className="w-full border border-[#d3dbe3] px-3 py-3"
                          onChange={(event) =>
                            setForm((current) => ({ ...current, nome: event.target.value }))
                          }
                          required
                          type="text"
                          value={form.nome}
                        />
                      </td>
                    </tr>
                    <tr>
                      <th className="w-[260px] border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">
                        Texto
                      </th>
                      <td className="border border-[#d7d7d7] px-4 py-3">
                        <textarea
                          className="min-h-[220px] w-full border border-[#d3dbe3] px-3 py-3"
                          maxLength={6000}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, texto: event.target.value }))
                          }
                          required
                          value={form.texto}
                        />
                      </td>
                    </tr>
                    {mode === "edit" ? (
                      <tr>
                        <th className="w-[260px] border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">
                          Status
                        </th>
                        <td className="border border-[#d7d7d7] px-4 py-3">
                          <select
                            className="w-full border border-[#d3dbe3] px-3 py-3"
                            onChange={(event) =>
                              setForm((current) => ({ ...current, status: event.target.value }))
                            }
                            value={form.status}
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
                  href={information ? `/painel/informacao/${information.id}` : "/painel/informacao"}
                >
                  Cancelar
                </Link>
              </div>
            </form>
          </section>

          <PainelAdminSidebar currentHref="/painel/informacao" legacyResources={legacyResources} />
        </div>
      </section>
    </div>
  );
}
