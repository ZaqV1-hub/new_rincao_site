import type { Metadata } from "next";
import { PainelProductsManager } from "@/components/painel-products-manager";
import { readRincaoContent } from "@/lib/rincao-content-store";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Ingressos e Itens | Rincao",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelIngressosItensRoute() {
  await requirePainelAccess(["vis_agenda", "vis_tabpre"], "/painel/passaportes-itens");
  const content = await readRincaoContent();

  return (
    <div className="space-y-3">
      <section className="panel-section p-4">
        <p className="panel-eyebrow">Produtos</p>
        <h2 className="mt-1 text-[24px] font-black leading-tight text-[#17351f]">
          Ingressos e itens
        </h2>
        <p className="mt-1 text-sm text-[#5f7564]">
          Produtos padrao usados no site e na agenda.
        </p>
      </section>

      <PainelProductsManager products={content.products} />
    </div>
  );
}


