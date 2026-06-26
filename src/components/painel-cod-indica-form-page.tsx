"use client";

import { CurrencyInput } from "@/components/currency-input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PainelCodIndicaFormValues } from "@/lib/painel-cod-indica";

type Props = {
  mode: "create" | "edit";
  initialValues: PainelCodIndicaFormValues;
  codigo?: string;
};

export function PainelCodIndicaFormPage({ mode, initialValues, codigo }: Props) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setFeedback(null);
    setError(null);

    const values = {
      codindica: String(formData.get("codindica") ?? ""),
      nmrepresentante: String(formData.get("nmrepresentante") ?? ""),
      validade: String(formData.get("validade") ?? ""),
      discountValue: String(formData.get("discountValue") ?? ""),
      cashbackPercent: String(formData.get("cashbackPercent") ?? ""),
      stcodindica: String(formData.get("stcodindica") ?? ""),
      email: String(formData.get("email") ?? ""),
    } satisfies PainelCodIndicaFormValues;

    const url =
      mode === "edit" && codigo
        ? `/api/painel/cod-indica/${encodeURIComponent(codigo)}`
        : "/api/painel/cod-indica";
    const method = mode === "edit" ? "PUT" : "POST";

    startTransition(async () => {
      try {
        const response = await fetch(url, {
          method,
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ values }),
        });

        const payload = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              data?: { codigo?: string; message?: string };
              error?: { message?: string };
            }
          | null;

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error?.message || "Falha ao salvar o codigo.");
        }

        const targetCode = payload.data?.codigo ?? codigo ?? values.codindica;
        if (targetCode) {
          router.push(`/painel/cod-indica/${encodeURIComponent(targetCode)}`);
          router.refresh();
          return;
        }

        setFeedback(payload.data?.message || "Codigo salvo com sucesso.");
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Falha ao salvar o codigo.");
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
        <Link className="text-[#1d68a2] underline" href="/painel/cod-indica">
          Cod Indica
        </Link>{" "}
        <span className="mx-2 text-[#b8b8b8]">&gt;</span>
        <span>{mode === "edit" ? "Editar" : "Cadastro"}</span>
      </div>

      {error ? (
        <div className="mt-4 border border-[#efc0c0] bg-[#fff0f0] px-4 py-3 text-sm text-[#7a2b2b]">
          {error}
        </div>
      ) : null}
      {feedback ? (
        <div className="mt-4 border border-[#bfd4e8] bg-[#eef5fb] px-4 py-3 text-sm text-[#205a7f]">
          {feedback}
        </div>
      ) : null}

      <form action={handleSubmit} className="mt-6 space-y-6">
        <div className="rounded-[6px] border border-[#d3e0ec] bg-[#f4f8fc] px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5f84a3]">
            Cadastro
          </p>
          <p className="mt-2 text-sm leading-6 text-[#5d7285]">
            Use o mesmo fluxo do painel antigo: defina o código, o representante,
            a validade, o desconto e o cashback antes de publicar.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Código
            <input
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444] disabled:bg-[#f2f2f2]"
              defaultValue={initialValues.codindica}
              disabled={mode === "edit"}
              maxLength={6}
              name="codindica"
              type="text"
            />
          </label>
          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Representante
            <input
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
              defaultValue={initialValues.nmrepresentante}
              name="nmrepresentante"
              type="text"
            />
          </label>
          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Email
            <input
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
              defaultValue={initialValues.email}
              name="email"
              type="email"
            />
          </label>
        </div>

        <div className="grid gap-5 lg:grid-cols-4">
          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Validade
            <input
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
              defaultValue={initialValues.validade}
              name="validade"
              type="date"
            />
          </label>
          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Valor de desconto
            <CurrencyInput
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
              defaultValue={initialValues.discountValue}
              name="discountValue"
            />
          </label>
          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Cashback (% por venda)
            <input
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
              defaultValue={initialValues.cashbackPercent}
              name="cashbackPercent"
              type="text"
            />
          </label>
          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Status
            <select
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
              defaultValue={initialValues.stcodindica}
              name="stcodindica"
            >
              <option value="ati">Ativo</option>
              <option value="ina">Inativo</option>
            </select>
          </label>
        </div>

        <p className="text-sm leading-6 text-[#666]">
          O desconto informado será aplicado na etapa final da compra quando o cliente
          usar este código. O cashback será calculado como percentual sobre o valor da venda.
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            className="inline-flex items-center justify-center rounded-full bg-[#1f4f7a] px-6 py-3 text-sm font-semibold text-white hover:bg-[#173d61] disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            Salvar código
          </button>
          <Link
            className="inline-flex items-center justify-center border border-[#c8c8c8] bg-white px-6 py-3 text-sm font-semibold text-[#4a4a4a]"
            href={codigo ? `/painel/cod-indica/${encodeURIComponent(codigo)}` : "/painel/cod-indica"}
          >
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  );
}
