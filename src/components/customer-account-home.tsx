import Link from "next/link";
import { IngressoShell } from "@/components/ingresso-shell";
import type { CustomerAccountSnapshot } from "@/lib/user-repository";

type CustomerAccountHomeProps = {
  snapshot: CustomerAccountSnapshot;
};

function valueOrDash(value: string | null | undefined) {
  return value && value.trim() ? value : "-";
}

function formatAddress(snapshot: CustomerAccountSnapshot) {
  const parts = [
    snapshot.profile.address,
    snapshot.profile.district,
    snapshot.profile.cityName,
    snapshot.profile.uf,
  ]
    .map((value) => value?.trim())
    .filter(Boolean);

  if (snapshot.profile.number?.trim()) {
    parts.push(snapshot.profile.number.trim());
  }

  return parts.length > 0 ? parts.join(" - ") : "-";
}

export function CustomerAccountHome({ snapshot }: CustomerAccountHomeProps) {
  return (
    <IngressoShell active="account" user={snapshot.profile}>
      <div className="mx-auto w-full max-w-[1180px] px-4 pt-6 md:px-6">
        <section className="estancia-card mt-6 p-6 text-left">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-[30px] font-black leading-tight text-[#17351f]">
              Meus Dados
            </h2>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/minha-conta/editar"
                className="estancia-button-secondary px-4 py-2 text-[14px]"
              >
                Alterar meus dados
              </Link>
              <Link
                href="/minha-conta/alterar-senha"
                className="estancia-button-secondary px-4 py-2 text-[14px]"
              >
                Alterar senha
              </Link>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-[22px] border border-[#dbe7d7]">
            <table className="w-full border-collapse">
              <tbody className="text-left text-[15px] text-[#516956]">
                <tr className="border-b border-[#edf3ea]">
                  <td className="w-1/2 px-5 py-4 align-top">
                    <p className="text-[12px] uppercase tracking-[0.16em] text-[#719168]">
                      Nome
                    </p>
                    <p className="mt-2 text-[17px] font-semibold text-[#17351f]">
                      {snapshot.profile.name}
                    </p>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <p className="text-[12px] uppercase tracking-[0.16em] text-[#719168]">
                      E-mail
                    </p>
                    <p className="mt-2 text-[17px] font-semibold text-[#17351f]">
                      {snapshot.profile.email ? (
                        <a
                          href={`mailto:${snapshot.profile.email}`}
                          className="text-[#2b8c46] underline underline-offset-2"
                        >
                          {snapshot.profile.email}
                        </a>
                      ) : (
                        "-"
                      )}
                    </p>
                  </td>
                </tr>
                <tr className="border-b border-[#edf3ea]">
                  <td className="px-5 py-4 align-top">
                    <p className="text-[12px] uppercase tracking-[0.16em] text-[#719168]">
                      Endereco Completo
                    </p>
                    <p className="mt-2 text-[17px] font-semibold text-[#17351f]">
                      {formatAddress(snapshot)}
                    </p>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <p className="text-[12px] uppercase tracking-[0.16em] text-[#719168]">
                      CEP
                    </p>
                    <p className="mt-2 text-[17px] font-semibold text-[#17351f]">
                      {valueOrDash(snapshot.profile.cep)}
                    </p>
                  </td>
                </tr>
                <tr className="border-b border-[#edf3ea]">
                  <td className="px-5 py-4 align-top">
                    <p className="text-[12px] uppercase tracking-[0.16em] text-[#719168]">
                      Telefone
                    </p>
                    <p className="mt-2 text-[17px] font-semibold text-[#17351f]">
                      {valueOrDash(snapshot.profile.phone)}
                    </p>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <p className="text-[12px] uppercase tracking-[0.16em] text-[#719168]">
                      Celular
                    </p>
                    <p className="mt-2 text-[17px] font-semibold text-[#17351f]">
                      {valueOrDash(snapshot.profile.mobile)}
                    </p>
                  </td>
                </tr>
                <tr>
                  <td className="px-5 py-4 align-top" colSpan={2}>
                    <p className="text-[12px] uppercase tracking-[0.16em] text-[#719168]">
                      Tipo de usuario
                    </p>
                    <p className="mt-2 text-[17px] font-semibold text-[#17351f]">
                      {snapshot.userType}
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {snapshot.agreements.length > 0 ? (
          <section className="estancia-card mt-6 p-6 text-left">
            <h3 className="text-[24px] font-black text-[#17351f]">
              Lista de convenios
            </h3>
            <div className="mt-4 overflow-hidden rounded-[22px] border border-[#dbe7d7]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f7fbf5]">
                    <th className="px-5 py-3 text-left text-[13px] font-normal uppercase tracking-[0.16em] text-[#719168]">
                      Convenio
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.agreements.map((agreement) => (
                    <tr
                      key={agreement.id}
                      className="border-t border-[#edf3ea] text-[16px] text-[#17351f]"
                    >
                      <td className="px-5 py-4">{agreement.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </IngressoShell>
  );
}
