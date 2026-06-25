"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PainelAdminBreadcrumb } from "@/components/painel-admin-breadcrumb";
import { PainelAdminSidebar } from "@/components/painel-admin-sidebar";
import type { PainelParametroGroup } from "@/lib/painel-parametros";

type PainelParametrosPageProps = {
  groups: PainelParametroGroup[];
  legacyResources: readonly string[];
};

export function PainelParametrosPage({
  groups,
  legacyResources,
}: PainelParametrosPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const group of groups) {
      for (const item of group.items) {
        initial[`${group.key}:${item.id}`] = item.value;
      }
    }
    return initial;
  });

  const payload = useMemo(
    () =>
      groups.flatMap((group) =>
        group.items.map((item) => ({
          group: group.key,
          id: item.id,
          value: values[`${group.key}:${item.id}`] ?? "",
        })),
      ),
    [groups, values],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/painel/parametro", {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ parameters: payload }),
        });
        const data = (await response.json().catch(() => null)) as
          | { ok?: boolean; data?: { message?: string }; error?: { message?: string } }
          | null;

        if (!response.ok || !data?.ok) {
          throw new Error(data?.error?.message || "Falha ao salvar os parametros.");
        }

        setFeedback({
          tone: "success",
          message: data.data?.message || "Dados salvos com sucesso.",
        });
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error ? error.message : "Falha ao salvar os parametros.",
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
            { label: "Parametros" },
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

        <div className="mt-6 flex items-center justify-between gap-4">
          <h1 className="text-[42px] leading-none text-[#205a7f]">Parametros</h1>
        </div>

        <div className="mt-7 grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0">
            <form onSubmit={handleSubmit}>
              <div className="overflow-x-auto border border-[#cfcfcf]">
                <table className="min-w-full border-collapse text-[15px]">
                  <thead className="bg-[#5f84a3] text-left text-white">
                    <tr>
                      <th className="border border-[#6f8ea8] px-4 py-3 font-normal">ID</th>
                      <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Descricao</th>
                      <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => (
                      <Fragment key={group.key}>
                        <tr>
                          <td
                            className="border border-[#d7d7d7] bg-[#dde7f0] px-4 py-3 font-semibold text-[#35506a]"
                            colSpan={3}
                          >
                            {group.label}
                          </td>
                        </tr>
                        {group.items.map((item) => {
                          const key = `${group.key}:${item.id}`;
                          return (
                            <tr key={key}>
                              <td className="border border-[#d7d7d7] px-4 py-3 align-top font-semibold">
                                {item.id}
                              </td>
                              <td
                                className="border border-[#d7d7d7] px-4 py-3 align-top text-[#555]"
                                dangerouslySetInnerHTML={{ __html: item.description }}
                              />
                              <td className="border border-[#d7d7d7] px-4 py-3 align-top">
                                {item.input === "password" ? (
                                  <input
                                    autoComplete="new-password"
                                    className="w-full border border-[#d3dbe3] px-3 py-3"
                                    onChange={(event) =>
                                      setValues((current) => ({
                                        ...current,
                                        [key]: event.target.value,
                                      }))
                                    }
                                    required={item.required}
                                    type="password"
                                    value={values[key] ?? ""}
                                  />
                                ) : (
                                  <textarea
                                    className="min-h-[120px] w-full border border-[#d3dbe3] px-3 py-3"
                                    onChange={(event) =>
                                      setValues((current) => ({
                                        ...current,
                                        [key]: event.target.value,
                                      }))
                                    }
                                    required={item.required}
                                    value={values[key] ?? ""}
                                  />
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6">
                <button
                  className="bg-[#3fae2a] px-8 py-4 text-base font-semibold text-white disabled:opacity-60"
                  disabled={isPending}
                  type="submit"
                >
                  {isPending ? "Salvando..." : "Enviar"}
                </button>
              </div>
            </form>
          </section>

          <PainelAdminSidebar currentHref="/painel/parametro" legacyResources={legacyResources} />
        </div>
      </section>
    </div>
  );
}
