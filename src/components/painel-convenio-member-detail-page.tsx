import Link from "next/link";
import type { PainelConvenioMemberDetail } from "@/lib/painel-convenio-members";

type PainelConvenioMemberDetailPageProps = {
  detail: PainelConvenioMemberDetail;
};

export function PainelConvenioMemberDetailPage({
  detail,
}: PainelConvenioMemberDetailPageProps) {
  return (
    <section className="grid gap-8">
      <div className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
        <div className="border-b border-[#d8d8d8] pb-3 text-sm text-[#909090]">
          <Link className="text-[#1d68a2] underline" href="/painel">
            Home
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <Link
            className="text-[#1d68a2] underline"
            href={`/painel/convenios/${detail.agreementId}/conveniados`}
          >
            Lista de conveniados
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <span>{detail.cpfLabel}</span>
        </div>

        <h1 className="mt-6 text-[34px] font-semibold text-[#205a7f]">{detail.cpfLabel}</h1>

        <div className="mt-6 overflow-x-auto border border-[#d7d7d7]">
          <table className="min-w-full border-collapse text-[15px]">
            <tbody>
              <tr className="bg-[#5f84a3] text-white">
                <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">CPF</th>
                <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">
                  Qtd. compra por dia
                </th>
                <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">
                  Data inicio
                </th>
              </tr>
              <tr>
                <td className="border border-[#d7d7d7] px-4 py-3">{detail.cpfLabel}</td>
                <td className="border border-[#d7d7d7] px-4 py-3">
                  {detail.dailyPurchaseLimit}
                </td>
                <td className="border border-[#d7d7d7] px-4 py-3">{detail.startDate ?? "-"}</td>
              </tr>
              <tr className="bg-[#5f84a3] text-white">
                <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">
                  Data fim
                </th>
                <th
                  className="border border-[#6f8ea8] px-4 py-3 text-left font-normal"
                  colSpan={2}
                >
                  Data de Cadastro
                </th>
              </tr>
              <tr>
                <td className="border border-[#d7d7d7] px-4 py-3">{detail.endDate ?? "-"}</td>
                <td className="border border-[#d7d7d7] px-4 py-3" colSpan={2}>
                  {detail.createdAt ?? "-"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {detail.userName ? (
        <div className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
          <h1 className="text-[30px] font-semibold text-[#205a7f]">{detail.userName}</h1>
          <div className="mt-6 overflow-x-auto border border-[#d7d7d7]">
            <table className="min-w-full border-collapse text-[15px]">
              <tbody>
                <tr className="bg-[#5f84a3] text-white">
                  <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">CPF</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">Nome</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">RG</th>
                </tr>
                <tr>
                  <td className="border border-[#d7d7d7] px-4 py-3">{detail.cpfLabel}</td>
                  <td className="border border-[#d7d7d7] px-4 py-3">{detail.userName}</td>
                  <td className="border border-[#d7d7d7] px-4 py-3">{detail.userRg ?? "-"}</td>
                </tr>
                <tr className="bg-[#5f84a3] text-white">
                  <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">
                    Nascimento
                  </th>
                  <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">Sexo</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">Email</th>
                </tr>
                <tr>
                  <td className="border border-[#d7d7d7] px-4 py-3">{detail.birthDate ?? "-"}</td>
                  <td className="border border-[#d7d7d7] px-4 py-3">{detail.genderLabel ?? "-"}</td>
                  <td className="border border-[#d7d7d7] px-4 py-3">{detail.email ?? "-"}</td>
                </tr>
                <tr className="bg-[#5f84a3] text-white">
                  <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">
                    Telefone
                  </th>
                  <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">Celular</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">Endereco</th>
                </tr>
                <tr>
                  <td className="border border-[#d7d7d7] px-4 py-3">{detail.phone ?? "-"}</td>
                  <td className="border border-[#d7d7d7] px-4 py-3">{detail.mobile ?? "-"}</td>
                  <td className="border border-[#d7d7d7] px-4 py-3">{detail.address ?? "-"}</td>
                </tr>
                <tr className="bg-[#5f84a3] text-white">
                  <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">CEP</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">Bairro</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">Regiao</th>
                </tr>
                <tr>
                  <td className="border border-[#d7d7d7] px-4 py-3">{detail.zipCode ?? "-"}</td>
                  <td className="border border-[#d7d7d7] px-4 py-3">{detail.district ?? "-"}</td>
                  <td className="border border-[#d7d7d7] px-4 py-3">{detail.cityLabel ?? "-"}</td>
                </tr>
                <tr className="bg-[#f0f4f7]">
                  <th className="border border-[#d7d7d7] px-4 py-3 text-left font-semibold text-[#475a6b]">
                    Status
                  </th>
                  <th className="border border-[#d7d7d7] px-4 py-3 text-left font-semibold text-[#475a6b]">
                    Data de Cadastro
                  </th>
                  <th className="border border-[#d7d7d7] px-4 py-3 text-left font-semibold text-[#475a6b]">
                    Ultimo Login
                  </th>
                </tr>
                <tr>
                  <td className="border border-[#d7d7d7] px-4 py-3">{detail.userStatusLabel ?? "-"}</td>
                  <td className="border border-[#d7d7d7] px-4 py-3">{detail.userCreatedAt ?? "-"}</td>
                  <td className="border border-[#d7d7d7] px-4 py-3">{detail.lastLoginLabel ?? "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
