"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { PainelCodIndicaMessageData } from "@/lib/painel-cod-indica";

type Props = {
  data: PainelCodIndicaMessageData;
};

export function PainelCodIndicaMessagePage({ data }: Props) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setFeedback(null);
    setError(null);

    const values = {
      codval: String(formData.get("codval") ?? ""),
      codven: String(formData.get("codven") ?? ""),
      codine: String(formData.get("codine") ?? ""),
    };

    startTransition(async () => {
      try {
        const response = await fetch("/api/painel/cod-indica/mensagem", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ values }),
        });

        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; data?: { message?: string }; error?: { message?: string } }
          | null;

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error?.message || "Falha ao salvar as mensagens.");
        }

        setFeedback(payload.data?.message || "Mensagens atualizadas com sucesso.");
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Falha ao salvar as mensagens.",
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
        <Link className="text-[#1d68a2] underline" href="/painel/cod-indica">
          Cod Indica
        </Link>{" "}
        <span className="mx-2 text-[#b8b8b8]">&gt;</span>
        <span>Mensagem</span>
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

      <form action={handleSubmit} className="mt-6 space-y-5">
        <label className="block text-sm font-semibold text-[#5a5a5a]">
          Mensagem de validacao
          <textarea
            className="mt-1 min-h-[140px] w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
            defaultValue={data.codval}
            name="codval"
          />
        </label>
        <label className="block text-sm font-semibold text-[#5a5a5a]">
          Mensagem de venda
          <textarea
            className="mt-1 min-h-[140px] w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
            defaultValue={data.codven}
            name="codven"
          />
        </label>
        <label className="block text-sm font-semibold text-[#5a5a5a]">
          Mensagem de email
          <textarea
            className="mt-1 min-h-[180px] w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
            defaultValue={data.codine}
            name="codine"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            className="inline-flex items-center justify-center bg-[#4aa329] px-6 py-3 text-sm font-semibold text-white hover:bg-[#3c8721] disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            Salvar mensagem
          </button>
          <Link
            className="inline-flex items-center justify-center border border-[#c8c8c8] bg-white px-6 py-3 text-sm font-semibold text-[#4a4a4a]"
            href="/painel/cod-indica"
          >
            Voltar
          </Link>
        </div>
      </form>
    </section>
  );
}
