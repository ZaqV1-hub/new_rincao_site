import Link from "next/link";
import type { PainelClienteDetailResult } from "@/lib/painel-clientes";

type PainelClienteDetailPageProps = {
  data: PainelClienteDetailResult;
};

function formatDate(value: string | null, withTime = false) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
        }
      : {}),
  }).format(date);
}

export function PainelClienteDetailPage({
  data,
}: PainelClienteDetailPageProps) {
  return (
    <div className="grid gap-5">
      <section className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
        <div className="border-b border-[#d8d8d8] pb-3 text-sm text-[#909090]">
          <Link className="text-[#1d68a2] underline" href="/painel">
            Home
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <Link className="text-[#1d68a2] underline" href="/painel/clientes">
            Lista de clientes
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <span>{data.client.name}</span>
        </div>

        <h1 className="mt-5 text-[28px] text-[#3f3f3f] md:text-[32px]">{data.client.name}</h1>

        <div className="mt-5 overflow-x-auto border border-[#cfcfcf]">
          <table className="min-w-full border-collapse text-[15px]">
            <thead className="bg-[#5f84a3] text-left text-white">
              <tr>
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Nome</th>
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Tipo</th>
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-[#d7d7d7] px-4 py-3">{data.client.name}</td>
                <td className="border border-[#d7d7d7] px-4 py-3">{data.client.typeName || "-"}</td>
                <td className="border border-[#d7d7d7] px-4 py-3">
                  {data.client.active ? "Ativo" : "Inativo"}
                </td>
              </tr>
              <tr className="bg-[#fafafa]">
                <th className="border border-[#d7d7d7] px-4 py-3 text-left font-bold text-[#555]" colSpan={3}>
                  Informacoes
                </th>
              </tr>
              <tr className="bg-[#fafafa]">
                <td className="border border-[#d7d7d7] px-4 py-4 text-[#444]" colSpan={3}>
                  <strong>ID:</strong> {data.client.id}
                  {"  "} | {"  "}
                  <strong>Criado em:</strong> {formatDate(data.client.createdAt, true)}
                  {"  "} | {"  "}
                  <strong>Atualizado em:</strong> {formatDate(data.client.updatedAt, true)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            className="text-[#1868d6] underline"
            href={`/painel/clientes/editar?id=${data.client.id}`}
          >
            Editar
          </Link>
          <Link
            className="text-[#1868d6] underline"
            href="/painel/clientes/passeios"
          >
            Passeios
          </Link>
        </div>
      </section>

      <section className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
        <h2 className="text-[28px] text-[#3f3f3f]">Historicos de Datas de Passeio</h2>
        <div className="mt-4 overflow-x-auto border border-[#cfcfcf]">
          <table className="min-w-full border-collapse text-[15px]">
            <thead className="bg-[#5f84a3] text-left text-white">
              <tr>
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Data do Passeio</th>
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.tripDates.length > 0 ? (
                data.tripDates.map((tripDate, index) => (
                  <tr className={index % 2 === 1 ? "bg-[#fafafa]" : "bg-white"} key={tripDate.agendaId}>
                    <td className="border border-[#d7d7d7] px-4 py-3">
                      <Link
                        className="text-[#1868d6] underline"
                        href={`/painel/clientes/passeios/${tripDate.agendaId}/alunos?clientId=${data.client.id}`}
                      >
                        {formatDate(tripDate.date)}
                      </Link>
                    </td>
                    <td className="border border-[#d7d7d7] px-4 py-3">
                      {tripDate.statusLabel}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="border border-[#d7d7d7] px-4 py-5 text-center" colSpan={2}>
                    Nao ha dados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {data.education ? (
        <section className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
          <h2 className="text-[28px] text-[#3f3f3f]">Estrutura Escolar</h2>
          <div className="mt-4 grid gap-4">
            {data.education.classes.length > 0 ? (
              data.education.classes.map((classItem) => (
                <div className="border border-[#d7d7d7]" key={classItem.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-[#eef3f8] px-4 py-3">
                    <strong className="text-[#2d4050]">{classItem.name}</strong>
                    <span className="text-sm text-[#5e6d7a]">
                      Status: {classItem.status === "ati" ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <div className="px-4 py-3 text-sm text-[#555]">
                    {classItem.periods.length > 0 ? (
                      classItem.periods.map((period) => period.name).join(", ")
                    ) : (
                      <span>Nenhum periodo cadastrado.</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#777]">Nenhuma turma cadastrada.</p>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
