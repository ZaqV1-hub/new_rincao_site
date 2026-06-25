"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type {
  PainelDiscountFormValues,
  PainelDiscountType,
} from "@/lib/painel-descontos";

type Props = {
  mode: "create" | "edit";
  discountId?: number;
  initialValues: PainelDiscountFormValues;
  discountTypes: PainelDiscountType[];
};

export function PainelDescontoFormPage({
  mode,
  discountId,
  initialValues,
  discountTypes,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);

    const values = {
      tipo_id: String(formData.get("tipo_id") ?? ""),
      nome: String(formData.get("nome") ?? ""),
      tipo_aplicacao: String(formData.get("tipo_aplicacao") ?? ""),
      valor: String(formData.get("valor") ?? ""),
    };

    const url =
      mode === "edit" && discountId
        ? `/api/painel/descontos/${discountId}`
        : "/api/painel/descontos";
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
          | { ok?: boolean; data?: { message?: string }; error?: { message?: string } }
          | null;

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error?.message || "Falha ao salvar o desconto.");
        }

        router.push("/painel/descontos");
        router.refresh();
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Falha ao salvar o desconto.",
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
        <Link className="text-[#1d68a2] underline" href="/painel/descontos">
          Descontos
        </Link>{" "}
        <span className="mx-2 text-[#b8b8b8]">&gt;</span>
        <span>{mode === "edit" ? "Editar desconto" : "Novo desconto"}</span>
      </div>

      {error ? (
        <div className="mt-4 border border-[#efc0c0] bg-[#fff0f0] px-4 py-3 text-sm text-[#7a2b2b]">
          {error}
        </div>
      ) : null}

      <form action={handleSubmit} className="mt-6 space-y-5">
        <label className="block text-sm font-semibold text-[#5a5a5a]">
          Categoria *
          <select
            className="mt-1 w-full max-w-[420px] border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
            defaultValue={initialValues.tipo_id}
            name="tipo_id"
            required
          >
            <option value="">- selecione -</option>
            {discountTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.description}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-[#5a5a5a]">
          Nome *
          <input
            className="mt-1 w-full max-w-[520px] border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
            defaultValue={initialValues.nome}
            maxLength={100}
            name="nome"
            required
            type="text"
          />
        </label>

        <label className="block text-sm font-semibold text-[#5a5a5a]">
          Aplicacao *
          <select
            className="mt-1 w-full max-w-[420px] border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
            defaultValue={initialValues.tipo_aplicacao}
            name="tipo_aplicacao"
            required
          >
            <option value="percentual">Percentual</option>
            <option value="valor_fixo">Valor fixo</option>
          </select>
        </label>

        <label className="block text-sm font-semibold text-[#5a5a5a]">
          Valor *
          <input
            className="mt-1 w-full max-w-[220px] border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
            defaultValue={initialValues.valor}
            maxLength={20}
            name="valor"
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
            href="/painel/descontos"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  );
}
