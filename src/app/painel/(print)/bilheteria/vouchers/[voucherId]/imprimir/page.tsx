import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PainelBilheteriaVoucherPrintView } from "@/components/painel-bilheteria-voucher-print-view";
import {
  asPainelBilheteriaError,
  getPainelBilheteriaVoucherPrintModel,
} from "@/lib/painel-bilheteria";
import { requirePainelAccess } from "@/lib/painel-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Painel - Impressao QR | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PainelBilheteriaVoucherPrintPage({
  params,
}: {
  params: Promise<{
    voucherId: string;
  }>;
}) {
  const session = await requirePainelAccess(
    ["vis_bilhet", "vis_compra"],
    "/painel/bilheteria/vouchers/imprimir",
  );
  const { voucherId } = await params;
  const id = Number(voucherId);

  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }

  let model;

  try {
    model = await getPainelBilheteriaVoucherPrintModel(id, {
      name: session.actorName,
      cpf: session.actorCpf,
    });
  } catch (error) {
    const normalized = asPainelBilheteriaError(error);

    if (
      normalized.code === "invalid_voucher_id" ||
      normalized.code === "voucher_not_found"
    ) {
      notFound();
    }

    return (
      <main className="min-h-screen bg-[#f4f4f4] px-4 py-10">
        <div className="mx-auto max-w-[540px] rounded-[28px] border border-[#d7e5ef] bg-white p-6 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#5d7282]">
            Impressao de voucher
          </p>
          <h1 className="legacy-condensed mt-2 text-4xl text-[#205a7f]">
            Impressao indisponivel
          </h1>
          <p className="mt-4 text-sm leading-6 text-[#5d7282]">
            {normalized.message}
          </p>
        </div>
      </main>
    );
  }

  return <PainelBilheteriaVoucherPrintView model={model} />;
}
