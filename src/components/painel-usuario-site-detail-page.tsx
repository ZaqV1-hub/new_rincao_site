"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PainelAdminBreadcrumb } from "@/components/painel-admin-breadcrumb";
import { PainelAdminSidebar } from "@/components/painel-admin-sidebar";
import { PainelClientObservations } from "@/components/painel-client-observations";
import type { PainelUsuarioSiteDetail } from "@/lib/painel-usuario-site";

type PainelUsuarioSiteDetailPageProps = {
  data: PainelUsuarioSiteDetail;
  legacyResources: readonly string[];
  canDeleteObservations: boolean;
  canManage: boolean;
  canViewPurchases: boolean;
};

export function PainelUsuarioSiteDetailPage({
  data,
  legacyResources,
  canDeleteObservations,
  canManage,
  canViewPurchases,
}: PainelUsuarioSiteDetailPageProps) {
  const router = useRouter();
  const [email, setEmail] = useState(data.email === "-" ? "" : data.email);
  const [senha, setSenha] = useState("");
  const [csenha, setCSenha] = useState("");
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isPasswordPending, startPasswordTransition] = useTransition();

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

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordFeedback(null);

    startPasswordTransition(async () => {
      try {
        const response = await fetch(`/api/painel/usuario-site/${data.cpf}/senha`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ senha, csenha }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; data?: { message?: string }; error?: { message?: string } }
          | null;

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error?.message || "Falha ao alterar a senha.");
        }

        setSenha("");
        setCSenha("");
        setPasswordFeedback({
          tone: "success",
          message: payload.data?.message || "Senha alterada com sucesso.",
        });
      } catch (error) {
        setPasswordFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "Falha ao alterar a senha.",
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
            { href: "/painel/usuario", label: "Administrativo" },
            { href: "/painel/usuario-site", label: "Usuários do site" },
            { label: data.name },
          ]}
        />

        <div className="mt-7 grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0">
            <h1 className="text-[42px] leading-none text-[#205a7f]">{data.name}</h1>

            {!data.profileExists ? (
              <div className="mt-5 rounded-[6px] border border-[#d7e3ee] bg-[#f8fbfe] px-4 py-3 text-sm text-[#35576f]">
                <p>CPF: {data.cpfLabel}</p>
                <p className="mt-2">Este CPF não tem cadastro de usuário do site. Abaixo estão as compras e observações disponíveis.</p>
              </div>
            ) : (
            <div className="mt-6 overflow-hidden rounded-[6px] border border-[#d7e3ee]">
              <table className="min-w-full border-collapse text-left text-[15px]">
                <tbody>
                  <tr>
                    <th className="w-1/4 border border-[#d7e3ee] bg-[#eef5fb] px-4 py-3 font-semibold text-[#133d63]">CPF</th>
                    <th className="w-1/4 border border-[#d7e3ee] bg-[#eef5fb] px-4 py-3 font-semibold text-[#133d63]">Nome</th>
                    <th className="border border-[#d7e3ee] bg-[#eef5fb] px-4 py-3 font-semibold text-[#133d63]" colSpan={2}>RG</th>
                  </tr>
                  <tr>
                    <td className="border border-[#d7e3ee] px-4 py-3">{data.cpfLabel}</td>
                    <td className="border border-[#d7e3ee] px-4 py-3">{data.name}</td>
                    <td className="border border-[#d7e3ee] px-4 py-3" colSpan={2}>{data.rg}</td>
                  </tr>
                  <tr>
                    <th className="border border-[#d7e3ee] bg-[#eef5fb] px-4 py-3 font-semibold text-[#133d63]">Nascimento</th>
                    <th className="border border-[#d7e3ee] bg-[#eef5fb] px-4 py-3 font-semibold text-[#133d63]">Sexo</th>
                    <th className="border border-[#d7e3ee] bg-[#eef5fb] px-4 py-3 font-semibold text-[#133d63]" colSpan={2}>E-mail</th>
                  </tr>
                  <tr>
                    <td className="border border-[#d7e3ee] px-4 py-3">{data.birthDateLabel}</td>
                    <td className="border border-[#d7e3ee] px-4 py-3">{data.sexLabel}</td>
                    <td className="border border-[#d7e3ee] px-4 py-3" colSpan={2}>{data.email}</td>
                  </tr>
                  <tr>
                    <th className="border border-[#d7e3ee] bg-[#eef5fb] px-4 py-3 font-semibold text-[#133d63]">Telefone</th>
                    <th className="border border-[#d7e3ee] bg-[#eef5fb] px-4 py-3 font-semibold text-[#133d63]">Celular</th>
                    <th className="border border-[#d7e3ee] bg-[#eef5fb] px-4 py-3 font-semibold text-[#133d63]">Endereço</th>
                    <th className="border border-[#d7e3ee] bg-[#eef5fb] px-4 py-3 font-semibold text-[#133d63]">Número</th>
                  </tr>
                  <tr>
                    <td className="border border-[#d7e3ee] px-4 py-3">{data.phone}</td>
                    <td className="border border-[#d7e3ee] px-4 py-3">{data.mobile}</td>
                    <td className="border border-[#d7e3ee] px-4 py-3">{data.address}</td>
                    <td className="border border-[#d7e3ee] px-4 py-3">{data.number}</td>
                  </tr>
                  <tr>
                    <th className="border border-[#d7e3ee] bg-[#eef5fb] px-4 py-3 font-semibold text-[#133d63]">CEP</th>
                    <th className="border border-[#d7e3ee] bg-[#eef5fb] px-4 py-3 font-semibold text-[#133d63]">Bairro</th>
                    <th className="border border-[#d7e3ee] bg-[#eef5fb] px-4 py-3 font-semibold text-[#133d63]">Região</th>
                    <th className="border border-[#d7e3ee] bg-[#eef5fb] px-4 py-3 font-semibold text-[#133d63]">Complemento</th>
                  </tr>
                  <tr>
                    <td className="border border-[#d7e3ee] px-4 py-3">{data.cep}</td>
                    <td className="border border-[#d7e3ee] px-4 py-3">{data.district}</td>
                    <td className="border border-[#d7e3ee] px-4 py-3">{data.regionLabel}</td>
                    <td className="border border-[#d7e3ee] px-4 py-3">{data.complement}</td>
                  </tr>
                  <tr className="bg-[#f8fbfe]">
                    <th className="border border-[#d7e3ee] px-4 py-3 font-semibold text-[#133d63]">Status</th>
                    <th className="border border-[#d7e3ee] px-4 py-3 font-semibold text-[#133d63]">Data de Cadastro</th>
                    <th className="border border-[#d7e3ee] px-4 py-3 font-semibold text-[#133d63]" colSpan={2}>Último Login</th>
                  </tr>
                  <tr className="bg-[#f8fbfe]">
                    <td className="border border-[#d7e3ee] px-4 py-3">{data.statusLabel}</td>
                    <td className="border border-[#d7e3ee] px-4 py-3">{data.createdAtLabel}</td>
                    <td className="border border-[#d7e3ee] px-4 py-3" colSpan={2}>{data.lastLoginLabel}</td>
                  </tr>
                  <tr className="bg-[#f8fbfe]">
                    <th className="border border-[#d7e3ee] px-4 py-3 font-semibold text-[#133d63]" colSpan={4}>Tipo de usuário</th>
                  </tr>
                  <tr className="bg-[#f8fbfe]">
                    <td className="border border-[#d7e3ee] px-4 py-3" colSpan={4}>{data.userType}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            )}

            {data.agreements.length > 0 ? (
              <>
                <h2 className="mt-8 text-[30px] leading-none text-[#205a7f]">Lista de convênios</h2>
                <div className="mt-4 overflow-x-auto rounded-[6px] border border-[#d7e3ee]">
                  <table className="min-w-full border-collapse text-[15px]">
                    <thead className="bg-[#eef5fb] text-left text-[#133d63]">
                      <tr>
                        <th className="border border-[#d7e3ee] px-4 py-3 font-semibold">Nome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.agreements.map((agreement, index) => (
                        <tr className={index % 2 === 1 ? "bg-[#f8fbfe]" : "bg-white"} key={agreement.id}>
                          <td className="border border-[#d7e3ee] px-4 py-3">
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

            <h2 className="mt-8 text-[30px] leading-none text-[#205a7f]">Compras do cliente</h2>
            <p className="mt-2 text-sm text-[#5d7282]">
              {data.purchaseHistory.total} compra{data.purchaseHistory.total === 1 ? "" : "s"} encontrada{data.purchaseHistory.total === 1 ? "" : "s"}.
            </p>
            {data.purchaseHistory.items.length ? (
              <div className="mt-4 overflow-x-auto rounded-[6px] border border-[#d7e3ee]">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead className="bg-[#eef5fb] text-[#133d63]">
                    <tr>
                      <th className="border border-[#d7e3ee] px-3 py-3">Compra</th>
                      <th className="border border-[#d7e3ee] px-3 py-3">Data</th>
                      <th className="border border-[#d7e3ee] px-3 py-3">Tipo</th>
                      <th className="border border-[#d7e3ee] px-3 py-3">Status</th>
                      <th className="border border-[#d7e3ee] px-3 py-3">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.purchaseHistory.items.map((purchase) => (
                      <tr className="even:bg-[#f8fbfe]" key={purchase.purchaseId}>
                        <td className="border border-[#d7e3ee] px-3 py-3">
                          {canViewPurchases ? (
                            <Link className="font-semibold text-[#1868d6] underline" href={`/painel/compras/${purchase.purchaseId}`}>
                              #{purchase.purchaseId}
                            </Link>
                          ) : `#${purchase.purchaseId}`}
                        </td>
                        <td className="border border-[#d7e3ee] px-3 py-3">{purchase.purchaseDate || "-"}</td>
                        <td className="border border-[#d7e3ee] px-3 py-3">{purchase.typeLabel}</td>
                        <td className="border border-[#d7e3ee] px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              purchase.status === "conc"
                                ? "bg-[#e2f4e8] text-[#24733c]"
                                : purchase.status === "pend"
                                  ? "bg-[#fff3cd] text-[#8a6500]"
                                  : purchase.status === "canc"
                                    ? "bg-[#fbe4e4] text-[#a83232]"
                                    : "bg-[#eef2f5] text-[#526779]"
                            }`}
                          >
                            {purchase.statusLabel}
                          </span>
                        </td>
                        <td className="border border-[#d7e3ee] px-3 py-3">R$ {purchase.totalValue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {data.purchaseHistory.totalPages > 1 ? (
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-[#35576f]">
                {data.purchaseHistory.page > 1 ? (
                  <Link className="font-semibold text-[#1868d6] underline" href={`/painel/usuario-site/${data.cpf}?comprasPagina=${data.purchaseHistory.page - 1}`}>
                    Compras anteriores
                  </Link>
                ) : null}
                <span>Página {data.purchaseHistory.page} de {data.purchaseHistory.totalPages}</span>
                {data.purchaseHistory.page < data.purchaseHistory.totalPages ? (
                  <Link className="font-semibold text-[#1868d6] underline" href={`/painel/usuario-site/${data.cpf}?comprasPagina=${data.purchaseHistory.page + 1}`}>
                    Próximas compras
                  </Link>
                ) : null}
              </div>
            ) : null}

            {canManage && data.profileExists ? <>
            <h2 className="mt-8 text-[30px] leading-none text-[#205a7f]">Alterar E-mail</h2>
            {feedback ? (
              <div
                className={`mt-4 border px-4 py-3 text-sm ${
                  feedback.tone === "success"
                    ? "border-[#c8def4] bg-[#eff6ff] text-[#1d4f91]"
                    : "border-[#efc0c0] bg-[#fff0f0] text-[#7a2b2b]"
                }`}
              >
                {feedback.message}
              </div>
            ) : null}
            <form className="mt-4 border border-[#d7e3ee] p-5" onSubmit={handleSubmit}>
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
                  className="bg-[#133d63] px-6 py-3 font-semibold text-white disabled:opacity-60"
                  disabled={isPending}
                  type="submit"
                >
                  {isPending ? "Alterando..." : "Alterar"}
                </button>
              </div>
            </form>

            <h2 className="mt-8 text-[30px] leading-none text-[#205a7f]">Alterar senha</h2>
            {passwordFeedback ? (
              <div
                className={`mt-4 border px-4 py-3 text-sm ${
                  passwordFeedback.tone === "success"
                    ? "border-[#c8def4] bg-[#eff6ff] text-[#1d4f91]"
                    : "border-[#efc0c0] bg-[#fff0f0] text-[#7a2b2b]"
                }`}
              >
                {passwordFeedback.message}
              </div>
            ) : null}
            <form className="mt-4 grid gap-4 border border-[#d7e3ee] p-5" onSubmit={handlePasswordSubmit}>
              <label className="grid gap-2 text-[15px] text-[#555]">
                Nova senha
                <input
                  className="border border-[#d3dbe3] px-3 py-3"
                  maxLength={20}
                  onChange={(event) => setSenha(event.target.value)}
                  type="password"
                  value={senha}
                />
              </label>
              <label className="grid gap-2 text-[15px] text-[#555]">
                Confirmar senha
                <input
                  className="border border-[#d3dbe3] px-3 py-3"
                  maxLength={20}
                  onChange={(event) => setCSenha(event.target.value)}
                  type="password"
                  value={csenha}
                />
              </label>
              <div>
                <button
                  className="bg-[#133d63] px-6 py-3 font-semibold text-white disabled:opacity-60"
                  disabled={isPasswordPending}
                  type="submit"
                >
                  {isPasswordPending ? "Alterando..." : "Alterar senha"}
                </button>
              </div>
            </form>
            </> : null}
          </section>

          <aside className="space-y-5">
            <PainelClientObservations
              apiUrl={`/api/painel/usuario-site/${data.cpf}/observacoes`}
              canAdd={canManage}
              canDelete={canDeleteObservations}
              initialObservations={data.observations}
              key={data.cpf}
            />
            <div className="rounded-[6px] border border-[#d7e3ee] bg-white shadow-[0_10px_28px_rgba(26,61,94,0.08)]">
              <div className="border-b border-[#d7e3ee] bg-[#eef5fb] px-5 py-3 text-[20px] text-[#36536b]">
                Ações
              </div>
              <div className="grid gap-3 px-5 py-4 text-[15px]">
                <Link className="text-[#666] underline" href={canManage ? "/painel/usuario-site" : "/painel/bilheteria"}>
                  {canManage ? "Lista de usuários" : "Voltar à bilheteria"}
                </Link>
              </div>
            </div>
            {canManage ? <PainelAdminSidebar currentHref="/painel/usuario-site" legacyResources={legacyResources} /> : null}
          </aside>
        </div>
      </section>
    </div>
  );
}
