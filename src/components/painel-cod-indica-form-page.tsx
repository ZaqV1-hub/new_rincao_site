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
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);

    const values = {
      codindica: String(formData.get("codindica") ?? ""),
      nmrepresentante: String(formData.get("nmrepresentante") ?? ""),
      validade: String(formData.get("validade") ?? ""),
      vlvendanormal: String(formData.get("vlvendanormal") ?? ""),
      vlvendainfant: String(formData.get("vlvendainfant") ?? ""),
      vlcashbacknormal: String(formData.get("vlcashbacknormal") ?? ""),
      vlcashbackinfant: String(formData.get("vlcashbackinfant") ?? ""),
      stcodindica: String(formData.get("stcodindica") ?? ""),
      email: String(formData.get("email") ?? ""),
      flpromocional: formData.get("flpromocional") ? "s" : "n",
      vldescnormal: String(formData.get("vldescnormal") ?? ""),
      vlcashbackpromonormal: String(formData.get("vlcashbackpromonormal") ?? ""),
      vlcashbackpromoinfant: String(formData.get("vlcashbackpromoinfant") ?? ""),
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
              data?: { codigo?: string };
              error?: { message?: string };
            }
          | null;

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error?.message || "Falha ao salvar o código.");
        }

        const targetCode = payload.data?.codigo ?? codigo ?? values.codindica;
        router.push(`/painel/cod-indica/${encodeURIComponent(targetCode)}`);
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Falha ao salvar o código.");
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
          Códigos de indicação
        </Link>{" "}
        <span className="mx-2 text-[#b8b8b8]">&gt;</span>
        <span>{mode === "edit" ? "Editar" : "Cadastro"}</span>
      </div>

      {error ? (
        <div className="mt-4 border border-[#efc0c0] bg-[#fff0f0] px-4 py-3 text-sm text-[#7a2b2b]">
          {error}
        </div>
      ) : null}

      <form action={handleSubmit} className="mt-6 space-y-5">
        <div className="grid gap-5 lg:grid-cols-3">
          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Código de indicação *
            <input
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444] disabled:bg-[#f2f2f2]"
              defaultValue={initialValues.codindica}
              disabled={mode === "edit"}
              maxLength={6}
              name="codindica"
              required
              type="text"
            />
          </label>

          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Representante *
            <input
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
              defaultValue={initialValues.nmrepresentante}
              name="nmrepresentante"
              required
              type="text"
            />
          </label>

          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Validade *
            <input
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
              defaultValue={initialValues.validade}
              name="validade"
              required
              type="date"
            />
          </label>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Valor adulto *
            <CurrencyInput
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
              defaultValue={initialValues.vlvendanormal}
              name="vlvendanormal"
              required
            />
          </label>

          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Valor criança *
            <CurrencyInput
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
              defaultValue={initialValues.vlvendainfant}
              name="vlvendainfant"
              required
            />
          </label>

          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Cashback adulto *
            <CurrencyInput
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
              defaultValue={initialValues.vlcashbacknormal}
              name="vlcashbacknormal"
              required
            />
          </label>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Cashback criança *
            <CurrencyInput
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
              defaultValue={initialValues.vlcashbackinfant}
              name="vlcashbackinfant"
              required
            />
          </label>

          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Email *
            <input
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
              defaultValue={initialValues.email}
              name="email"
              required
              type="email"
            />
          </label>

          <label className="flex min-h-[86px] items-center gap-3 border border-[#c8c8c8] bg-white px-4 py-3 text-sm font-semibold text-[#5a5a5a]">
            <input
              className="h-5 w-5 accent-[#1f4f7a]"
              defaultChecked={initialValues.flpromocional === "s"}
              name="flpromocional"
              type="checkbox"
            />
            Permitir em data promocional
          </label>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Valor de desconto
            <CurrencyInput
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
              defaultValue={initialValues.vldescnormal}
              name="vldescnormal"
            />
          </label>

          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Cashback adulto promocional
            <CurrencyInput
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
              defaultValue={initialValues.vlcashbackpromonormal}
              name="vlcashbackpromonormal"
            />
          </label>

          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Cashback criança promocional
            <CurrencyInput
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
              defaultValue={initialValues.vlcashbackpromoinfant}
              name="vlcashbackpromoinfant"
            />
          </label>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <label className="block text-sm font-semibold text-[#5a5a5a]">
            Status *
            <select
              className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
              defaultValue={initialValues.stcodindica}
              name="stcodindica"
              required
            >
              <option value="ati">Ativo</option>
              <option value="ina">Inativo</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            className="inline-flex items-center justify-center rounded-full bg-[#1f4f7a] px-6 py-3 text-sm font-semibold text-white hover:bg-[#173d61] disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            Salvar
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
