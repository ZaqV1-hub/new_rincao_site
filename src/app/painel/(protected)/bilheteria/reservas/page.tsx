import Link from "next/link";
import type { Metadata } from "next";
import { PainelBilheteriaPageHeader } from "@/components/painel-bilheteria-page-header";
import {
  formatPainelBilheteriaCpf,
  formatPainelBilheteriaMoney,
} from "@/lib/painel-bilheteria-format";
import { listPainelBilheteriaHistory } from "@/lib/painel-bilheteria";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Reservas | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelBilheteriaReservasPage({
  searchParams,
}: {
  searchParams: Promise<{
    cpf?: string;
    page?: string;
  }>;
}) {
  const session = await requirePainelAccess("vis_bilhet", "/painel/bilheteria/reservas");
  const params = await searchParams;
  const history = await listPainelBilheteriaHistory({
    cpf: params.cpf,
    type: "reser",
    page: params.page,
    pageSize: 30,
  });

  return (
    <div className="grid gap-5">
      <PainelBilheteriaPageHeader
        current="reservations"
        isManager={session.legacyRoleId === 1}
        title="Reservas"
        description="Consulta operacional das reservas do painel, com entrada dedicada para pagamento."
      />

      <section className="rounded-[28px] border border-[#d7e5ef] bg-white p-6 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
        <form className="flex flex-wrap gap-4" method="GET">
          <label className="grid gap-2 text-sm font-semibold text-[#345062]">
            CPF
            <input
              name="cpf"
              defaultValue={history.filters.cpf}
              className="rounded-[16px] border border-[#c9d8e3] bg-white px-4 py-3 text-sm text-[#1b3447]"
            />
          </label>
          <button
            type="submit"
            className="self-end rounded-full bg-[#246b99] px-5 py-3 text-sm font-semibold text-white"
          >
            Filtrar
          </button>
          <Link
            href="/painel/bilheteria/reservas"
            className="self-end rounded-full border border-[#c9d8e3] px-5 py-3 text-sm font-semibold text-[#205a7f] hover:bg-[#edf5fa]"
          >
            Limpar
          </Link>
        </form>

        {history.items.length === 0 ? (
          <div className="mt-5 rounded-[22px] border border-dashed border-[#c8d8e3] bg-[#f8fbfd] px-5 py-8 text-sm text-[#5d7282]">
            Nenhuma reserva encontrada.
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 overflow-hidden rounded-[22px] border border-[#d9e3eb] text-sm">
              <thead className="bg-[#edf5fa] text-left text-[#345062]">
                <tr>
                  <th className="px-4 py-3">Reserva</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">CPF</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Pagamento</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {history.items.map((item) => (
                  <tr key={item.purchaseId} className="border-t border-[#e4edf4] bg-white">
                    <td className="px-4 py-3 font-semibold text-[#205a7f]">
                      <Link
                        href={`/painel/bilheteria/reservas/${item.purchaseId}`}
                        className="hover:underline"
                      >
                        #{item.purchaseId}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{item.purchaseDate || "-"}</td>
                    <td className="px-4 py-3">
                      {formatPainelBilheteriaCpf(item.cpf)}
                    </td>
                    <td className="px-4 py-3">{item.statusLabel}</td>
                    <td className="px-4 py-3">{item.paymentLabels.join(", ") || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      {formatPainelBilheteriaMoney(item.totalValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
