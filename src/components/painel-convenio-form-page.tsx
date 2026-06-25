"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type {
  PainelConvenioFormValues,
  PainelConvenioPriceTableOption,
} from "@/lib/painel-convenios";

type PainelConvenioFormPageProps = {
  mode: "create" | "edit";
  agreementId?: number;
  agreementName?: string | null;
  initialValues: PainelConvenioFormValues;
  priceTableOptions: PainelConvenioPriceTableOption[];
};

export function PainelConvenioFormPage({
  mode,
  agreementId,
  agreementName,
  initialValues,
  priceTableOptions,
}: PainelConvenioFormPageProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setFeedback(null);
    setError(null);

    const values = {
      nmconvenio: String(formData.get("nmconvenio") ?? ""),
      dtini: String(formData.get("dtini") ?? ""),
      dtfim: String(formData.get("dtfim") ?? ""),
      idtabpreco: String(formData.get("idtabpreco") ?? ""),
    };

    const url =
      mode === "edit" && agreementId
        ? `/api/painel/convenios/${agreementId}`
        : "/api/painel/convenios";
    const method = mode === "edit" ? "PUT" : "POST";

    startTransition(async () => {
      try {
        const response = await fetch(url, {
          method,
          credentials: "same-origin",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ values }),
        });

        const payload = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              data?: { agreementId?: number; message?: string };
              error?: { message?: string };
            }
          | null;

        if (!response.ok || !payload?.ok) {
          throw new Error(
            payload?.error?.message || "Falha ao salvar o convenio.",
          );
        }

        const targetId = payload.data?.agreementId ?? agreementId;
        if (targetId) {
          router.push(`/painel/convenios/${targetId}`);
          router.refresh();
          return;
        }

        setFeedback(payload.data?.message || "Convenio salvo com sucesso.");
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Falha ao salvar o convenio.",
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
        <Link className="text-[#1d68a2] underline" href="/painel/convenios">
          Lista de convenios
        </Link>{" "}
        {mode === "edit" && agreementId ? (
          <>
            <span className="mx-2 text-[#b8b8b8]">&gt;</span>
            <Link
              className="text-[#1d68a2] underline"
              href={`/painel/convenios/${agreementId}`}
            >
              {agreementName || `Convenio #${agreementId}`}
            </Link>{" "}
          </>
        ) : null}
        <span className="mx-2 text-[#b8b8b8]">&gt;</span>
        <span>{mode === "edit" ? "Editar" : "Adicionar"}</span>
      </div>

      {error ? (
        <div className="mt-4 border border-[#efc0c0] bg-[#fff0f0] px-4 py-3 text-sm text-[#7a2b2b]">
          {error}
        </div>
      ) : null}
      {feedback ? (
        <div className="mt-4 border border-[#b7dfc0] bg-[#edf8f0] px-4 py-3 text-sm text-[#245336]">
          {feedback}
        </div>
      ) : null}

      <form action={handleSubmit} className="mt-6 space-y-6">
        <div className="grid gap-5 lg:grid-cols-3">
          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Nome
            <input
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
              defaultValue={initialValues.nmconvenio}
              maxLength={120}
              name="nmconvenio"
              type="text"
            />
          </label>
          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Data Inicio
            <input
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
              defaultValue={initialValues.dtini}
              name="dtini"
              type="date"
            />
          </label>
          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Data Fim
            <input
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
              defaultValue={initialValues.dtfim}
              name="dtfim"
              type="date"
            />
          </label>
        </div>

        <label className="block max-w-[420px] text-sm font-semibold text-[#5a5a5a]">
          Tabela de Preco
          <select
            className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
            defaultValue={initialValues.idtabpreco}
            name="idtabpreco"
          >
            <option value="">Selecione a Tabela de Preco...</option>
            {priceTableOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>

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
            href={mode === "edit" && agreementId ? `/painel/convenios/${agreementId}` : "/painel/convenios"}
          >
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  );
}
