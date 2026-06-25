"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PainelAdminBreadcrumb } from "@/components/painel-admin-breadcrumb";
import { PainelAdminSidebar } from "@/components/painel-admin-sidebar";
import type { PainelUsuarioFormValues, PainelUsuarioItem } from "@/lib/painel-usuarios";

type PainelUsuarioFormPageProps = {
  legacyResources: readonly string[];
  mode: "create" | "edit";
  user?: PainelUsuarioItem;
};

const roleOptions = [
  { value: "1", label: "Gerente" },
  { value: "3", label: "Bilheteria" },
  { value: "2", label: "Funcionario" },
];

export function PainelUsuarioFormPage({
  legacyResources,
  mode,
  user,
}: PainelUsuarioFormPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);
  const [form, setForm] = useState<PainelUsuarioFormValues>({
    cpf: user?.cpfLabel || "",
    senha: "",
    csenha: "",
    nmusuario: user?.name || "",
    email: user?.email || "",
    idpapel: String(user?.roleId ?? "2"),
    stusuario: user?.status ?? "ati",
  });

  const title = mode === "create" ? "Adicionar usuario" : "Editar usuario";
  const submitLabel = mode === "create" ? "Cadastrar" : "Salvar";
  const destination = useMemo(
    () => (mode === "create" ? "/api/painel/usuario" : `/api/painel/usuario/${user?.cpf}`),
    [mode, user?.cpf],
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
              data?: { id?: string; message?: string };
              error?: { message?: string };
            }
          | null;

        if (!response.ok || !payload?.ok) {
          throw new Error(
            payload?.error?.message || "Falha ao salvar o usuario.",
          );
        }

        setFeedback({
          tone: "success",
          message: payload.data?.message || "Usuario salvo com sucesso.",
        });

        const nextCpf = payload.data?.id || user?.cpf;
        router.replace(
          nextCpf ? `/painel/usuario/detalhe/${nextCpf}` : "/painel/usuario",
        );
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao salvar o usuario.",
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
                          disabled={mode === "edit"}
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
                        Nome
                      </th>
                      <td className="border border-[#d7d7d7] px-4 py-3">
                        <input
                          className="w-full border border-[#d3dbe3] px-3 py-3"
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              nmusuario: event.target.value,
                            }))
                          }
                          required
                          type="text"
                          value={form.nmusuario}
                        />
                      </td>
                    </tr>
                    <tr>
                      <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">
                        E-mail
                      </th>
                      <td className="border border-[#d7d7d7] px-4 py-3">
                        <input
                          className="w-full border border-[#d3dbe3] px-3 py-3"
                          onChange={(event) =>
                            setForm((current) => ({ ...current, email: event.target.value }))
                          }
                          type="email"
                          value={form.email}
                        />
                      </td>
                    </tr>
                    <tr>
                      <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">
                        Papel
                      </th>
                      <td className="border border-[#d7d7d7] px-4 py-3">
                        <select
                          className="w-full border border-[#d3dbe3] px-3 py-3"
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              idpapel: event.target.value,
                            }))
                          }
                          value={form.idpapel}
                        >
                          {roleOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
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
                              setForm((current) => ({
                                ...current,
                                stusuario: event.target.value,
                              }))
                            }
                            value={form.stusuario}
                          >
                            <option value="ati">Ativo</option>
                            <option value="ina">Inativo</option>
                          </select>
                        </td>
                      </tr>
                    ) : (
                      <>
                        <tr>
                          <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">
                            Senha
                          </th>
                          <td className="border border-[#d7d7d7] px-4 py-3">
                            <input
                              className="w-full border border-[#d3dbe3] px-3 py-3"
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  senha: event.target.value,
                                }))
                              }
                              required
                              type="password"
                              value={form.senha}
                            />
                          </td>
                        </tr>
                        <tr>
                          <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">
                            Confirmacao da senha
                          </th>
                          <td className="border border-[#d7d7d7] px-4 py-3">
                            <input
                              className="w-full border border-[#d3dbe3] px-3 py-3"
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  csenha: event.target.value,
                                }))
                              }
                              required
                              type="password"
                              value={form.csenha}
                            />
                          </td>
                        </tr>
                      </>
                    )}
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
                  href={user ? `/painel/usuario/detalhe/${user.cpf}` : "/painel/usuario"}
                >
                  Cancelar
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
