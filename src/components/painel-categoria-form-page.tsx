"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PainelDiscountTypeFormValues } from "@/lib/painel-descontos";

type Props = {
  mode: "create" | "edit";
  typeId?: number;
  initialValues: PainelDiscountTypeFormValues;
};

export function PainelCategoriaFormPage({ mode, typeId, initialValues }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);
    const values = {
      descricao: String(formData.get("descricao") ?? ""),
    };
    const url =
      mode === "edit" && typeId
        ? `/api/painel/categorias/${typeId}`
        : "/api/painel/categorias";
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
          throw new Error(payload?.error?.message || "Falha ao salvar a categoria.");
        }
        router.push("/painel/categorias");
        router.refresh();
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Falha ao salvar a categoria.",
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
        <Link className="text-[#1d68a2] underline" href="/painel/categorias">
          Tipos de desconto
        </Link>{" "}
        <span className="mx-2 text-[#b8b8b8]">&gt;</span>
        <span>{mode === "edit" ? "Editar tipo" : "Novo tipo"}</span>
      </div>

      {error ? (
        <div className="mt-4 border border-[#efc0c0] bg-[#fff0f0] px-4 py-3 text-sm text-[#7a2b2b]">
          {error}
        </div>
      ) : null}

      <form action={handleSubmit} className="mt-6 space-y-5">
        <label className="block text-sm font-semibold text-[#5a5a5a]">
          Descricao *
          <input
            className="mt-1 w-full max-w-[420px] border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
            defaultValue={initialValues.descricao}
            maxLength={50}
            name="descricao"
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
            href="/painel/categorias"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  );
}
