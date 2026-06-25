import Link from "next/link";
import { PainelAdminBreadcrumb } from "@/components/painel-admin-breadcrumb";
import { PainelAdminSidebar } from "@/components/painel-admin-sidebar";
import type { PainelSocioDetail } from "@/lib/painel-socios";

type PainelSocioDetailPageProps = {
  data: PainelSocioDetail;
  legacyResources: readonly string[];
};

export function PainelSocioDetailPage({
  data,
  legacyResources,
}: PainelSocioDetailPageProps) {
  return (
    <div className="grid gap-5">
      <section className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
        <PainelAdminBreadcrumb
          items={[
            { href: "/painel", label: "Home" },
            { href: "/painel/administrativo", label: "Administrativo" },
            { href: "/painel/socio", label: "Socios" },
            { label: data.name },
          ]}
        />

        <div className="mt-7 grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0">
            <h1 className="text-[42px] leading-none text-[#205a7f]">{data.name}</h1>

            <div className="mt-6 overflow-hidden border border-[#d7e1e8]">
              <table className="min-w-full border-collapse text-left text-[15px]">
                <tbody>
                  <tr>
                    <th className="w-1/3 border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">
                      CPF
                    </th>
                    <th className="w-1/3 border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">
                      Data inicio
                    </th>
                    <th className="w-1/3 border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">
                      Data fim
                    </th>
                  </tr>
                  <tr>
                    <td className="border border-[#d7d7d7] px-4 py-3">{data.cpfLabel}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{data.startDateLabel}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{data.endDateLabel}</td>
                  </tr>
                  <tr>
                    <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">
                      Nome
                    </th>
                    <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">
                      Quantidade de compra por dia
                    </th>
                    <th className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">
                      Categoria
                    </th>
                  </tr>
                  <tr>
                    <td className="border border-[#d7d7d7] px-4 py-3">{data.name}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">
                      {data.dailyPurchaseLimit ?? "-"}
                    </td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{data.categoryName}</td>
                  </tr>
                  <tr>
                    <th
                      className="border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]"
                      colSpan={3}
                    >
                      Data de cadastro
                    </th>
                  </tr>
                  <tr>
                    <td className="border border-[#d7d7d7] px-4 py-3" colSpan={3}>
                      {data.createdAtLabel}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <aside className="space-y-5">
            <div className="border border-[#d8d8d8] bg-white">
              <div className="border-b border-[#d8d8d8] bg-[#f3f3f3] px-5 py-3 text-[20px] text-[#666]">
                Acoes
              </div>
              <div className="grid gap-3 px-5 py-4 text-[15px]">
                <Link className="text-[#666] underline" href="/painel/socio/adicionar">
                  Adicionar socio
                </Link>
                <Link className="text-[#666] underline" href="/painel/socio">
                  Lista de socios
                </Link>
                <Link className="text-[#666] underline" href={`/painel/socio/${data.cpf}/editar`}>
                  Editar
                </Link>
              </div>
            </div>

            <PainelAdminSidebar currentHref="/painel/socio" legacyResources={legacyResources} />
          </aside>
        </div>
      </section>
    </div>
  );
}
