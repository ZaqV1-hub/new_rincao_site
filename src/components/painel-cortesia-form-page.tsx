"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PainelCortesiaFormValues } from "@/lib/painel-cortesias";

type Props = {
  mode: "create" | "edit";
  courtesyId?: number;
  initialValues: PainelCortesiaFormValues;
};

export function PainelCortesiaFormPage({
  mode,
  courtesyId,
  initialValues,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);
    const values = {
      nome: String(formData.get("nome") ?? ""),
    };
    const url =
      mode === "edit" && courtesyId
        ? `/api/painel/cortesias/${courtesyId}`
        : "/api/painel/cortesias";
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
          | { ok?: boolean; error?: { message?: string } }
          | null;

        if (!response.ok || !payload?.ok) {
          throw new Error(
            payload?.error?.message || "Falha ao salvar o autorizador.",
          );
        }

        router.push("/painel/cortesias");
        router.refresh();
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Falha ao salvar o autorizador.",
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
        <Link className="text-[#1d68a2] underline" href="/painel/cortesias">
          Cortesias
        </Link>{" "}
        <span className="mx-2 text-[#b8b8b8]">&gt;</span>
        <span>{mode === "edit" ? "Editar autorizador" : "Novo autorizador"}</span>
      </div>

      {error ? (
        <div className="mt-4 border border-[#efc0c0] bg-[#fff0f0] px-4 py-3 text-sm text-[#7a2b2b]">
          {error}
        </div>
      ) : null}

      <form action={handleSubmit} className="mt-6 space-y-5">
        <label className="block text-sm font-semibold text-[#5a5a5a]">
          Nome da pessoa *
          <input
            className="mt-1 w-full max-w-[520px] border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
            defaultValue={initialValues.nome}
            maxLength={100}
            name="nome"
            required
            type="text"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            className="inline-flex items-center justify-center bg-[#4aa329] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            Salvar
          </button>
          <Link
            className="inline-flex items-center justify-center border border-[#c8c8c8] bg-white px-6 py-3 text-sm font-semibold text-[#4a4a4a]"
            href="/painel/cortesias"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  );
}
