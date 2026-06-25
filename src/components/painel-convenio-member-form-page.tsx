"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PainelConvenioMemberFormValues } from "@/lib/painel-convenio-members";

type PainelConvenioMemberFormPageProps = {
  mode: "create" | "edit";
  agreementId: number;
  memberId?: string;
  initialValues: PainelConvenioMemberFormValues;
};

export function PainelConvenioMemberFormPage({
  mode,
  agreementId,
  memberId,
  initialValues,
}: PainelConvenioMemberFormPageProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);

    const values = {
      cpf: String(formData.get("cpf") ?? ""),
      qtcompradia: String(formData.get("qtcompradia") ?? ""),
      dtiniado: String(formData.get("dtiniado") ?? ""),
      dtfimado: String(formData.get("dtfimado") ?? ""),
    };

    const url =
      mode === "edit" && memberId
        ? `/api/painel/convenios/${agreementId}/conveniados/${memberId}`
        : `/api/painel/convenios/${agreementId}/conveniados`;
    const method = mode === "edit" ? "PUT" : "POST";

    startTransition(async () => {
      try {
        const response = await fetch(url, {
          method,
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ values }),
        });

        const payload = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              data?: { id?: string };
              error?: { message?: string };
            }
          | null;

        if (!response.ok || !payload?.ok) {
          throw new Error(
            payload?.error?.message || "Falha ao salvar o conveniado.",
          );
        }

        router.push(
          `/painel/convenios/${agreementId}/conveniados/${payload.data?.id ?? values.cpf}`,
        );
        router.refresh();
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Falha ao salvar o conveniado.",
        );
      }
    });
  }

  return (
    <section className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
      <div className="border-b border-[#d8d8d8] pb-3 text-sm text-[#909090]">
        <Link className="text-[#1d68a2] underline" href="/painel">
          Home
        </Link>{" "}
        <span className="mx-2 text-[#b8b8b8]">&gt;</span>
        <Link
          className="text-[#1d68a2] underline"
          href={`/painel/convenios/${agreementId}/conveniados`}
        >
          Lista de conveniados
        </Link>{" "}
        <span className="mx-2 text-[#b8b8b8]">&gt;</span>
        <span>{mode === "edit" ? "Editar" : "Adicionar"}</span>
      </div>

      {error ? (
        <div className="mt-4 border border-[#efc0c0] bg-[#fff0f0] px-4 py-3 text-sm text-[#7a2b2b]">
          {error}
        </div>
      ) : null}

      <form action={handleSubmit} className="mt-6 space-y-6">
        <div className="grid gap-5 lg:grid-cols-2">
          <label className="block text-sm font-semibold text-[#5a5a5a]">
            CPF
            <input
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
              defaultValue={initialValues.cpf}
              name="cpf"
              type="text"
            />
          </label>
          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Quantidade de compra por dia
            <input
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
              defaultValue={initialValues.qtcompradia}
              name="qtcompradia"
              type="number"
            />
          </label>
          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Data Inicio
            <input
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
              defaultValue={initialValues.dtiniado}
              name="dtiniado"
              type="date"
            />
          </label>
          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Data Fim
            <input
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
              defaultValue={initialValues.dtfimado}
              name="dtfimado"
              type="date"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            className="inline-flex items-center justify-center bg-[#4aa329] px-6 py-3 text-sm font-semibold text-white hover:bg-[#3c8721] disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            Enviar
          </button>
          <Link
            className="inline-flex items-center justify-center border border-[#c8c8c8] bg-white px-6 py-3 text-sm font-semibold text-[#4a4a4a]"
            href={
              mode === "edit" && memberId
                ? `/painel/convenios/${agreementId}/conveniados/${memberId}`
                : `/painel/convenios/${agreementId}/conveniados`
            }
          >
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  );
}
