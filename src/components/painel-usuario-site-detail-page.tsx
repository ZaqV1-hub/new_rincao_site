"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PainelAdminBreadcrumb } from "@/components/painel-admin-breadcrumb";
import { PainelAdminSidebar } from "@/components/painel-admin-sidebar";
import type { PainelUsuarioSiteDetail } from "@/lib/painel-usuario-site";

type PainelUsuarioSiteDetailPageProps = {
  data: PainelUsuarioSiteDetail;
  legacyResources: readonly string[];
};

export function PainelUsuarioSiteDetailPage({
  data,
  legacyResources,
}: PainelUsuarioSiteDetailPageProps) {
  const router = useRouter();
  const [email, setEmail] = useState(data.email === "-" ? "" : data.email);
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/painel/usuario-site/${data.cpf}/email`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; data?: { message?: string }; error?: { message?: string } }
          | null;

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error?.message || "Falha ao alterar o e-mail.");
        }

        setFeedback({
          tone: "success",
          message: payload.data?.message || "E-mail alterado com sucesso.",
        });
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "Falha ao alterar o e-mail.",
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
            { href: "/painel/usuario-site", label: "Usuario Site" },
            { label: data.name },
          ]}
        />

        <div className="mt-7 grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0">
            <h1 className="text-[42px] leading-none text-[#205a7f]">{data.name}</h1>

            <div className="mt-6 overflow-hidden border border-[#d7e1e8]">
              <table className="min-w-full border-collapse text-left text-[15px]">
                <tbody>
                  <tr>
                    <th className="w-1/4 border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">CPF</th>
                    <th className="w-1/4 border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">Nome</th>
                    <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]" colSpan={2}>RG</th>
                  </tr>
                  <tr>
                    <td className="border border-[#d7d7d7] px-4 py-3">{data.cpfLabel}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{data.name}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3" colSpan={2}>{data.rg}</td>
                  </tr>
                  <tr>
                    <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">Nascimento</th>
                    <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">Sexo</th>
                    <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]" colSpan={2}>Email</th>
                  </tr>
                  <tr>
                    <td className="border border-[#d7d7d7] px-4 py-3">{data.birthDateLabel}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{data.sexLabel}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3" colSpan={2}>{data.email}</td>
                  </tr>
                  <tr>
                    <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">Telefone</th>
                    <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">Celular</th>
                    <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">Endereco</th>
                    <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">Numero</th>
                  </tr>
                  <tr>
                    <td className="border border-[#d7d7d7] px-4 py-3">{data.phone}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{data.mobile}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{data.address}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{data.number}</td>
                  </tr>
                  <tr>
                    <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">CEP</th>
                    <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">Bairro</th>
                    <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">Regiao</th>
                    <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">Complemento</th>
                  </tr>
                  <tr>
                    <td className="border border-[#d7d7d7] px-4 py-3">{data.cep}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{data.district}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{data.regionLabel}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{data.complement}</td>
                  </tr>
                  <tr className="bg-[#fafafa]">
                    <th className="border border-[#d7d7d7] px-4 py-3 font-semibold text-[#5a5a5a]">Status</th>
                    <th className="border border-[#d7d7d7] px-4 py-3 font-semibold text-[#5a5a5a]">Data de Cadastro</th>
                    <th className="border border-[#d7d7d7] px-4 py-3 font-semibold text-[#5a5a5a]" colSpan={2}>Ultimo Login</th>
                  </tr>
                  <tr className="bg-[#fafafa]">
                    <td className="border border-[#d7d7d7] px-4 py-3">{data.statusLabel}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{data.createdAtLabel}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3" colSpan={2}>{data.lastLoginLabel}</td>
                  </tr>
                  <tr className="bg-[#fafafa]">
                    <th className="border border-[#d7d7d7] px-4 py-3 font-semibold text-[#5a5a5a]" colSpan={4}>Tipo de usuario</th>
                  </tr>
                  <tr className="bg-[#fafafa]">
                    <td className="border border-[#d7d7d7] px-4 py-3" colSpan={4}>{data.userType}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {data.agreements.length > 0 ? (
              <>
                <h2 className="mt-8 text-[30px] leading-none text-[#205a7f]">Lista de convenios</h2>
                <div className="mt-4 overflow-x-auto border border-[#cfcfcf]">
                  <table className="min-w-full border-collapse text-[15px]">
                    <thead className="bg-[#5f84a3] text-left text-white">
                      <tr>
                        <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Nome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.agreements.map((agreement, index) => (
                        <tr className={index % 2 === 1 ? "bg-[#fafafa]" : "bg-white"} key={agreement.id}>
                          <td className="border border-[#d7d7d7] px-4 py-3">
                            <Link className="text-[#1868d6] underline" href={`/painel/convenios/${agreement.id}`}>
                              {agreement.name}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}

            <h2 className="mt-8 text-[30px] leading-none text-[#205a7f]">Alterar E-mail</h2>
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
            <form className="mt-4 border border-[#d7e1e8] p-5" onSubmit={handleSubmit}>
              <label className="grid gap-2 text-[15px] text-[#555]">
                E-mail
                <input
                  className="border border-[#d3dbe3] px-3 py-3"
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  value={email}
                />
              </label>
              <div className="mt-4">
                <button
                  className="bg-[#3fae2a] px-6 py-3 font-semibold text-white disabled:opacity-60"
                  disabled={isPending}
                  type="submit"
                >
                  {isPending ? "Alterando..." : "Alterar"}
                </button>
              </div>
            </form>
          </section>

          <aside className="space-y-5">
            <div className="border border-[#d8d8d8] bg-white">
              <div className="border-b border-[#d8d8d8] bg-[#f3f3f3] px-5 py-3 text-[20px] text-[#666]">
                Acoes
              </div>
              <div className="grid gap-3 px-5 py-4 text-[15px]">
                <Link className="text-[#666] underline" href="/painel/usuario-site">
                  Lista de usuarios
                </Link>
              </div>
            </div>
            <PainelAdminSidebar currentHref="/painel/usuario-site" legacyResources={legacyResources} />
          </aside>
        </div>
      </section>
    </div>
  );
}
