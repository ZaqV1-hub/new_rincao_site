"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PainelAdminBreadcrumb } from "@/components/painel-admin-breadcrumb";
import { PainelAdminSidebar } from "@/components/painel-admin-sidebar";
import type { PainelUsuarioItem } from "@/lib/painel-usuarios";

type PainelUsuarioAccountPageProps = {
  data: PainelUsuarioItem;
  legacyResources: readonly string[];
};

export function PainelUsuarioAccountPage({
  data,
  legacyResources,
}: PainelUsuarioAccountPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);
  const [senha, setSenha] = useState("");
  const [csenha, setCSenha] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/painel/usuario/minha-conta/senha", {
          method: "PATCH",
          credentials: "same-origin",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ senha, csenha }),
        });
        const payload = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              data?: { message?: string };
              error?: { message?: string };
            }
          | null;

        if (!response.ok || !payload?.ok) {
          throw new Error(
            payload?.error?.message || "Falha ao alterar a senha.",
          );
        }

        setFeedback({
          tone: "success",
          message: payload.data?.message || "Senha atualizada com sucesso.",
        });
        setSenha("");
        setCSenha("");
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao alterar a senha.",
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
            { href: "/painel/usuario", label: "Usuarios" },
            { label: "Minha conta" },
          ]}
        />

        <div className="mt-7 grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0">
            <h1 className="text-[42px] leading-none text-[#205a7f]">Minha conta</h1>

            <div className="mt-6 overflow-hidden border border-[#d7e1e8]">
              <table className="min-w-full border-collapse text-left text-[15px]">
                <tbody>
                  <tr>
                    <th className="w-[260px] border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">
                      Nome
                    </th>
                    <td className="border border-[#d7d7d7] px-4 py-3">{data.name}</td>
                  </tr>
                  <tr>
                    <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">
                      CPF
                    </th>
                    <td className="border border-[#d7d7d7] px-4 py-3">{data.cpfLabel}</td>
                  </tr>
                  <tr>
                    <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">
                      Papel
                    </th>
                    <td className="border border-[#d7d7d7] px-4 py-3">{data.roleLabel}</td>
                  </tr>
                </tbody>
              </table>
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

            <form className="mt-6 grid gap-5 max-w-[620px]" onSubmit={handleSubmit}>
              <label className="grid gap-2 text-sm font-semibold text-[#5a5a5a]">
                Nova senha
                <input
                  className="border border-[#d3dbe3] px-3 py-3 text-base font-normal"
                  onChange={(event) => setSenha(event.target.value)}
                  required
                  type="password"
                  value={senha}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#5a5a5a]">
                Confirmacao da senha
                <input
                  className="border border-[#d3dbe3] px-3 py-3 text-base font-normal"
                  onChange={(event) => setCSenha(event.target.value)}
                  required
                  type="password"
                  value={csenha}
                />
              </label>

              <div className="flex flex-wrap gap-4">
                <button
                  className="bg-[#3fae2a] px-8 py-4 text-base font-semibold text-white disabled:opacity-60"
                  disabled={isPending}
                  type="submit"
                >
                  {isPending ? "Salvando..." : "Alterar senha"}
                </button>
                <Link
                  className="border border-[#cfcfcf] px-8 py-4 text-base text-[#666]"
                  href={`/painel/usuario/detalhe/${data.cpf}`}
                >
                  Voltar
                </Link>
              </div>
            </form>
          </section>

          <PainelAdminSidebar currentHref="/painel/usuario" legacyResources={legacyResources} />
        </div>
      </section>
    </div>
  );
}
