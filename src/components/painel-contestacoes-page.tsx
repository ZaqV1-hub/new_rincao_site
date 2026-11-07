import React from "react";
import Link from "next/link";
import { PainelCompraContestacoes } from "@/components/painel-compra-contestacoes";

export function PainelContestacoesPage() {
  return (
    <section className="grid gap-5">
      <header className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
        <Link className="text-sm text-[#1d68a2] underline" href="/painel/compras">
          Lista de compras / reservas
        </Link>
        <h1 className="mt-4 text-[28px] font-semibold text-[#205a7f]">Contestação de pagamentos Cielo</h1>
        <p className="mt-2 text-sm text-[#345062]">
          Acompanhe casos por prazo, dossiês arquivados e o resultado da defesa. Os casos elegíveis são processados automaticamente.
        </p>
      </header>
      <PainelCompraContestacoes />
    </section>
  );
}
