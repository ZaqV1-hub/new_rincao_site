import Link from "next/link";
import { PainelAdminBreadcrumb } from "@/components/painel-admin-breadcrumb";
import type { PainelTabelaPrecoItem } from "@/lib/painel-tabela-preco";

type PainelTabelaPrecoDetailPageProps = {
  data: PainelTabelaPrecoItem;
  legacyResources: readonly string[];
};

export function PainelTabelaPrecoDetailPage({
  data,
}: PainelTabelaPrecoDetailPageProps) {
  return (
    <div className="grid gap-5">
      <section className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
        <PainelAdminBreadcrumb
          items={[
            { href: "/painel", label: "Home" },
            { href: "/painel/tabela-preco", label: "Tabela de Preço" },
            { label: data.name },
          ]}
        />

        <div className="mt-7 grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0">
            <h1 className="text-[42px] leading-none text-[#205a7f]">{data.name}</h1>

            <div className="mt-6 overflow-hidden border border-[#d7e1e8]">
              <table className="min-w-full border-collapse text-left text-[15px]">
                <tbody>
                  {[
                    ["Valor normal", `R$ ${data.normalValue}`],
                    ["Valor infantil", `R$ ${data.childValue}`],
                    ["Valor normal bilheteria", `R$ ${data.gateNormalValue}`],
                    ["Valor infantil bilheteria", `R$ ${data.gateChildValue}`],
                    ["Status", data.statusLabel],
                  ].map(([label, value]) => (
                    <tr key={label}>
                      <th className="w-[260px] border border-[#d7e3ee] bg-[#eef5fb] px-4 py-3 font-semibold text-[#133d63]">
                        {label}
                      </th>
                      <td className="border border-[#d7e3ee] px-4 py-3 text-[#355066]">
                        {value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="grid gap-5 self-start">
            <section className="rounded-[6px] border border-[#d7e1e8] bg-white shadow-[0_10px_28px_rgba(26,61,94,0.08)]">
              <div className="grid gap-3 px-6 py-5 text-[17px] text-[#5a5a5a]">
                <Link className="text-[#666] underline" href="/painel/tabela-preco">
                  Lista de tabelas
                </Link>
                <Link
                  className="text-[#666] underline"
                  href={`/painel/tabela-preco/${data.id}/editar`}
                >
                  Editar
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </section>
    </div>
  );
}

