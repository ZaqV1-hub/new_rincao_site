import type { Metadata } from "next";
import { PainelBilheteriaPageHeader } from "@/components/painel-bilheteria-page-header";
import { getPainelBilheteriaIndicators } from "@/lib/painel-bilheteria";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Indicadores da Bilheteria | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

function formatDateInput(value: string | null | undefined) {
  const normalized = String(value ?? "").slice(0, 10);

  if (!normalized) {
    return "";
  }

  return normalized;
}

export default async function PainelBilheteriaIndicadoresPage({
  searchParams,
}: {
  searchParams: Promise<{
    data?: string;
  }>;
}) {
  const session = await requirePainelAccess("vis_bilhet", "/painel/bilheteria/indicadores");
  const params = await searchParams;
  const indicators = await getPainelBilheteriaIndicators(params.data);

  return (
    <div className="grid gap-5">
      <PainelBilheteriaPageHeader
        current="indicators"
        isManager={session.legacyRoleId === 1}
        title="Indicadores da bilheteria"
        description="Leitura operacional do dia, com reservas previstas, compras online ainda nao usadas e entradas confirmadas."
      />

      <section className="rounded-[28px] border border-[#d7e5ef] bg-white p-6 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
        <form className="flex flex-wrap items-end gap-4" method="GET">
          <label className="grid gap-2 text-sm font-semibold text-[#345062]">
            Data
            <input
              type="date"
              name="data"
              defaultValue={formatDateInput(indicators.date)}
              className="rounded-[16px] border border-[#c9d8e3] bg-white px-4 py-3 text-sm text-[#1b3447]"
            />
          </label>
          <button
            type="submit"
            className="rounded-full bg-[#246b99] px-5 py-3 text-sm font-semibold text-white"
          >
            Atualizar
          </button>
        </form>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-[24px] border border-[#d9e3eb] bg-[#f7fafc] p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#5d7282]">
              Reservas previstas
            </div>
            <div className="mt-3 text-4xl font-semibold text-[#205a7f]">
              {indicators.plannedReservations}
            </div>
          </div>
          <div className="rounded-[24px] border border-[#d9e3eb] bg-[#f7fafc] p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#5d7282]">
              Compras online pendentes
            </div>
            <div className="mt-3 text-4xl font-semibold text-[#205a7f]">
              {indicators.plannedOnlinePurchases}
            </div>
          </div>
          <div className="rounded-[24px] border border-[#d9e3eb] bg-[#f7fafc] p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#5d7282]">
              Total previsto
            </div>
            <div className="mt-3 text-4xl font-semibold text-[#205a7f]">
              {indicators.plannedTotal}
            </div>
          </div>
          <div className="rounded-[24px] border border-[#d9e3eb] bg-[#f7fafc] p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#5d7282]">
              Entradas confirmadas
            </div>
            <div className="mt-3 text-4xl font-semibold text-[#205a7f]">
              {indicators.confirmedEntries}
            </div>
          </div>
          <div className="rounded-[24px] border border-[#d9e3eb] bg-[#f7fafc] p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#5d7282]">
              Compras fora da data
            </div>
            <div className="mt-3 text-4xl font-semibold text-[#205a7f]">
              {indicators.walkInEntries}
            </div>
          </div>
          <div className="rounded-[24px] border border-[#d9e3eb] bg-[#edf5fa] p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#5d7282]">
              Total de entradas
            </div>
            <div className="mt-3 text-4xl font-semibold text-[#205a7f]">
              {indicators.totalEntries}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
