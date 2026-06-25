import Link from "next/link";
import { PainelAdminBreadcrumb } from "@/components/painel-admin-breadcrumb";
import { PainelAdminSidebar } from "@/components/painel-admin-sidebar";
import type { PainelInformacaoItem } from "@/lib/painel-informacoes";

type PainelInformacaoDetailPageProps = {
  data: PainelInformacaoItem;
  legacyResources: readonly string[];
};

export function PainelInformacaoDetailPage({
  data,
  legacyResources,
}: PainelInformacaoDetailPageProps) {
  return (
    <div className="grid gap-5">
      <section className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
        <PainelAdminBreadcrumb
          items={[
            { href: "/painel", label: "Home" },
            { href: "/painel/administrativo", label: "Administrativo" },
            { href: "/painel/informacao", label: "Informacoes" },
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
                    <th className="w-[260px] border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">
                      Texto
                    </th>
                    <td className="border border-[#d7d7d7] px-4 py-3 text-[#355066]">
                      {data.paragraphs.length > 0
                        ? data.paragraphs.map((paragraph) => (
                            <div key={paragraph}>{paragraph}</div>
                          ))
                        : "-"}
                    </td>
                  </tr>
                  <tr>
                    <th className="w-[260px] border border-[#d7d7d7] bg-[#f7f7f7] px-4 py-3 font-semibold text-[#5a5a5a]">
                      Status
                    </th>
                    <td className="border border-[#d7d7d7] px-4 py-3 text-[#355066]">
                      {data.statusLabel}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <aside className="grid gap-5 self-start">
            <section className="rounded-[6px] border border-[#d7e1e8] bg-white shadow-[0_10px_28px_rgba(26,61,94,0.08)]">
              <div className="grid gap-3 px-6 py-5 text-[17px] text-[#5a5a5a]">
                <Link className="text-[#666] underline" href="/painel/informacao">
                  Lista de informacoes
                </Link>
                <Link className="text-[#666] underline" href={`/painel/informacao/${data.id}/editar`}>
                  Editar
                </Link>
              </div>
            </section>

            <PainelAdminSidebar currentHref="/painel/informacao" legacyResources={legacyResources} />
          </aside>
        </div>
      </section>
    </div>
  );
}
