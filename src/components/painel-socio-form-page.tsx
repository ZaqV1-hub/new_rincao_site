"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PainelAdminBreadcrumb } from "@/components/painel-admin-breadcrumb";
import { PainelAdminSidebar } from "@/components/painel-admin-sidebar";
import type {
  PainelSocioDetail,
  PainelSocioFormValues,
} from "@/lib/painel-socios";

type PainelSocioFormPageProps = {
  legacyResources: readonly string[];
  mode: "create" | "edit";
  socio?: PainelSocioDetail;
  categoryOptions: Array<{ id: number; name: string }>;
};

export function PainelSocioFormPage({
  legacyResources,
  mode,
  socio,
  categoryOptions,
}: PainelSocioFormPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);
  const [form, setForm] = useState<PainelSocioFormValues>({
    cpf: socio?.cpfLabel || "",
    dtinisoc: socio?.startDate || "",
    dtfimsoc: socio?.endDate || "",
    nmsocio: socio?.name || "",
    qtcompradia:
      socio?.dailyPurchaseLimit == null ? "1" : String(socio.dailyPurchaseLimit),
    idsociocateg: socio?.categoryId == null ? "" : String(socio.categoryId),
    stsocio: socio?.status || "ati",
  });

  const title = mode === "create" ? "Adicionar socio" : "Editar socio";
  const submitLabel = mode === "create" ? "Cadastrar" : "Salvar";
  const destination = useMemo(
    () => (mode === "create" ? "/api/painel/socio" : `/api/painel/socio/${socio?.cpf}`),
    [mode, socio?.cpf],
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
          headers: { "content-type": "application/json" },
          body: JSON.stringify(form),
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; data?: { id?: string; message?: string }; error?: { message?: string } }
          | null;

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error?.message || "Falha ao salvar o socio.");
        }

        setFeedback({
          tone: "success",
          message: payload.data?.message || "Socio salvo com sucesso.",
        });
        const nextCpf = payload.data?.id || form.cpf.replace(/\D+/g, "") || socio?.cpf;
        router.replace(nextCpf ? `/painel/socio/${nextCpf}` : "/painel/socio");
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "Falha ao salvar o socio.",
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
            { href: "/painel/socio", label: "Socios" },
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
                        CPF
                      </th>
                      <td className="border border-[#d7d7d7] px-4 py-3">
                        <input
                          className="w-full border border-[#d3dbe3] px-3 py-3"
                          onChange={(event) =>
                            setForm((current) => ({ ...current, cpf: event.target.value }))
                          }
                          required
                          type="text"
                          value={form.cpf}
                        />
                      </td>
                    </tr>
                    <tr>
                      <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">
                        Data Inicio
                      </th>
                      <td className="border border-[#d7d7d7] px-4 py-3">
                        <input
                          className="w-full border border-[#d3dbe3] px-3 py-3"
                          onChange={(event) =>
                            setForm((current) => ({ ...current, dtinisoc: event.target.value }))
                          }
                          required
                          type="date"
                          value={form.dtinisoc}
                        />
                      </td>
                    </tr>
                    <tr>
                      <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">
                        Data Fim
                      </th>
                      <td className="border border-[#d7d7d7] px-4 py-3">
                        <input
                          className="w-full border border-[#d3dbe3] px-3 py-3"
                          onChange={(event) =>
                            setForm((current) => ({ ...current, dtfimsoc: event.target.value }))
                          }
                          required
                          type="date"
                          value={form.dtfimsoc}
                        />
                      </td>
                    </tr>
                    <tr>
                      <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">
                        Nome
                      </th>
                      <td className="border border-[#d7d7d7] px-4 py-3">
                        <input
                          className="w-full border border-[#d3dbe3] px-3 py-3"
                          onChange={(event) =>
                            setForm((current) => ({ ...current, nmsocio: event.target.value }))
                          }
                          required
                          type="text"
                          value={form.nmsocio}
                        />
                      </td>
                    </tr>
                    <tr>
                      <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">
                        Quantidade de compra por dia
                      </th>
                      <td className="border border-[#d7d7d7] px-4 py-3">
                        <input
                          className="w-full border border-[#d3dbe3] px-3 py-3"
                          min={0}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, qtcompradia: event.target.value }))
                          }
                          required
                          type="number"
                          value={form.qtcompradia}
                        />
                      </td>
                    </tr>
                    <tr>
                      <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">
                        Categoria
                      </th>
                      <td className="border border-[#d7d7d7] px-4 py-3">
                        <select
                          className="w-full border border-[#d3dbe3] px-3 py-3"
                          onChange={(event) =>
                            setForm((current) => ({ ...current, idsociocateg: event.target.value }))
                          }
                          required
                          value={form.idsociocateg}
                        >
                          <option value="">Selecione a categoria...</option>
                          {categoryOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                    {mode === "edit" ? (
                      <tr>
                        <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">
                          Status
                        </th>
                        <td className="border border-[#d7d7d7] px-4 py-3">
                          <select
                            className="w-full border border-[#d3dbe3] px-3 py-3"
                            onChange={(event) =>
                              setForm((current) => ({ ...current, stsocio: event.target.value }))
                            }
                            value={form.stsocio}
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
                  href={socio ? `/painel/socio/${socio.cpf}` : "/painel/socio"}
                >
                  Cancelar
                </Link>
              </div>
            </form>
          </section>

          <PainelAdminSidebar currentHref="/painel/socio" legacyResources={legacyResources} />
        </div>
      </section>
    </div>
  );
}
