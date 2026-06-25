import Link from "next/link";
import type { PainelConvenioDetail } from "@/lib/painel-convenios";

type PainelConvenioDetailPageProps = {
  agreement: PainelConvenioDetail;
};

export function PainelConvenioDetailPage({
  agreement,
}: PainelConvenioDetailPageProps) {
  return (
    <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
        <div className="border-b border-[#d8d8d8] pb-3 text-sm text-[#909090]">
          <Link className="text-[#1d68a2] underline" href="/painel">
            Home
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <Link className="text-[#1d68a2] underline" href="/painel/convenios">
            Lista de convenios
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <span>{agreement.name}</span>
        </div>

        <h1 className="mt-6 text-[34px] font-semibold text-[#205a7f]">{agreement.name}</h1>

        <div className="mt-6 overflow-x-auto border border-[#d7d7d7]">
          <table className="min-w-full border-collapse text-[15px]">
            <tbody>
              <tr className="bg-[#5f84a3] text-white">
                <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">
                  Nome
                </th>
                <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">
                  Data inicio
                </th>
                <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">
                  Data fim
                </th>
              </tr>
              <tr>
                <td className="border border-[#d7d7d7] px-4 py-3">{agreement.name}</td>
                <td className="border border-[#d7d7d7] px-4 py-3">
                  {agreement.startDate ?? "-"}
                </td>
                <td className="border border-[#d7d7d7] px-4 py-3">
                  {agreement.endDate ?? "-"}
                </td>
              </tr>
              <tr className="bg-[#5f84a3] text-white">
                <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">
                  Qtd Conveniados
                </th>
                <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">
                  Qtd Conveniados ativos
                </th>
                <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">
                  Qtd Conveniados inativos
                </th>
              </tr>
              <tr>
                <td className="border border-[#d7d7d7] px-4 py-3">
                  {agreement.totalMembers}
                </td>
                <td className="border border-[#d7d7d7] px-4 py-3">
                  {agreement.activeMembers}
                </td>
                <td className="border border-[#d7d7d7] px-4 py-3">
                  {agreement.inactiveMembers}
                </td>
              </tr>
              <tr className="bg-[#5f84a3] text-white">
                <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">
                  Tabela de Preco
                </th>
                <th
                  className="border border-[#6f8ea8] px-4 py-3 text-left font-normal"
                  colSpan={2}
                >
                  Data de Cadastro
                </th>
              </tr>
              <tr>
                <td className="border border-[#d7d7d7] px-4 py-3">
                  {agreement.priceTableName ?? "-"}
                </td>
                <td className="border border-[#d7d7d7] px-4 py-3" colSpan={2}>
                  {agreement.createdAt ?? "-"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <aside className="self-start rounded-[6px] border border-[#d7d7d7] bg-[#f6f7f8] p-4 shadow-[0_10px_28px_rgba(26,61,94,0.08)]">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#6f7f8d]">
          Convenio
        </h2>
        <ul className="mt-3 space-y-3 text-[15px]">
          <li>
            <Link
              className="text-[#1d68a2] underline"
              href="/painel/convenios/adicionar"
            >
              Adicionar convenio
            </Link>
          </li>
          <li>
            <Link className="text-[#1d68a2] underline" href="/painel/convenios">
              Lista de convenios
            </Link>
          </li>
          <li>
            <Link
              className="text-[#1d68a2] underline"
              href={`/painel/convenios/${agreement.id}/editar`}
            >
              Editar
            </Link>
          </li>
        </ul>

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-[0.12em] text-[#6f7f8d]">
          Conveniado
        </h2>
        <ul className="mt-3 space-y-3 text-[15px]">
          <li>
            <Link
              className="text-[#1d68a2] underline"
              href={`/painel/convenios/${agreement.id}/conveniados`}
            >
              Lista de conveniados
            </Link>
          </li>
          <li>
            <Link
              className="text-[#1d68a2] underline"
              href={`/painel/convenios/${agreement.id}/importacao`}
            >
              Importar conveniados
            </Link>
          </li>
        </ul>
      </aside>
    </section>
  );
}
