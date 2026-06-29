import Image from "next/image";
import Link from "next/link";
import { segmentCards, structureFeatures } from "@/lib/site-content";

const serviceSteps = [
  {
    title: "Famílias e day use",
    text: "A agenda publica e a compra online continuam como porta de entrada para quem vai visitar o clube em data aberta.",
  },
  {
    title: "Escolas e grupos",
    text: "Paginas institucionais, cadastros de grupo e fluxos escolares seguem separados para manter a operacao correta.",
  },
  {
    title: "Confraternizacoes",
    text: "Empresas, igrejas, ONGs e grupos mistos podem abrir o atendimento consultivo diretamente pelas paginas dedicadas.",
  },
];

export function ServicesPage() {
  return (
    <div className="bg-[#f6f8fb] text-[#12344f]">
      <section className="relative isolate overflow-hidden bg-[#12344f] px-5 pb-18 pt-[118px] text-white md:pb-24">
        <div className="absolute inset-0">
          <div className="h-full w-full bg-[radial-gradient(circle_at_top,#3b6ea3_0%,#173b63_50%,#0d2234_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(8,18,28,0.2)_0%,rgba(8,18,28,0.5)_100%)]" />
        </div>

        <div className="relative mx-auto max-w-[1240px] text-left">
          <p className="text-[12px] font-bold uppercase tracking-[0.24em] text-white/64">
            Servicos e segmentos
          </p>
          <h1 className="mt-4 max-w-[760px] font-[var(--font-salsa)] text-[clamp(2.5rem,6vw,5rem)] leading-[0.95] text-white">
            Cada perfil de cliente tem uma pagina e um fluxo publico proprio.
          </h1>
          <p className="mt-6 max-w-[660px] text-[1rem] leading-8 text-white/78 md:text-[1.08rem]">
            A camada publica do site organiza melhor os acessos para day use, escola,
            grupos e atendimento comercial, mantendo as mesmas funcionalidades operacionais.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/agenda" className="rincao-button min-w-[210px]">
              Abrir agenda
            </Link>
            <Link
              href="/grupo-escola"
              className="rincao-button-secondary min-w-[210px] border-white/16 bg-white/10 text-white hover:border-white/26 hover:bg-white/14"
            >
              Cadastrar grupo
            </Link>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 md:py-20">
        <div className="mx-auto max-w-[1240px]">
          <div className="grid gap-5 xl:grid-cols-3">
            {serviceSteps.map((step, index) => (
              <article
                key={step.title}
                className="rounded-[28px] border border-[#d8e2eb] bg-white p-7 text-left shadow-[0_18px_40px_rgba(18,52,79,0.08)]"
              >
                <p className="font-[var(--font-salsa)] text-[3rem] leading-none text-[#d8e2eb]">
                  0{index + 1}
                </p>
                <h2 className="mt-4 text-[1.4rem] font-bold text-[#12344f]">
                  {step.title}
                </h2>
                <p className="mt-3 text-[0.98rem] leading-8 text-[#5c7488]">
                  {step.text}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {segmentCards.map((segment) => (
              <article
                key={segment.href}
                className="rounded-[28px] border border-[#d8e2eb] bg-white p-6 text-left shadow-[0_18px_40px_rgba(18,52,79,0.08)]"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#eef4f9]">
                  <Image
                    src={segment.iconSrc}
                    alt={segment.title}
                    width={34}
                    height={34}
                    className="h-8 w-8 object-contain"
                  />
                </div>
                <h3 className="mt-5 text-[1.35rem] font-bold text-[#12344f]">
                  {segment.title}
                </h3>
                <p className="mt-3 text-[0.95rem] leading-7 text-[#5c7488]">
                  {segment.text}
                </p>
                <Link
                  href={segment.href}
                  className="mt-6 inline-flex items-center gap-2 text-[0.92rem] font-extrabold text-[#1d6fb8] hover:text-[#155990]"
                >
                  Abrir pagina
                  <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#eef4f9] px-5 py-16 md:py-20">
        <div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[minmax(0,1.05fr)_420px]">
          <div className="rounded-[30px] border border-[#d8e2eb] bg-white p-8 text-left shadow-[0_18px_40px_rgba(18,52,79,0.08)]">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[#5f84a7]">
              Estrutura de apoio
            </p>
            <h2 className="mt-4 font-[var(--font-salsa)] text-[clamp(2rem,4vw,3rem)] leading-[0.98] text-[#12344f]">
              O comercial se apoia na mesma estrutura publica do clube.
            </h2>
            <ul className="mt-6 grid gap-3 md:grid-cols-2">
              {structureFeatures.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-[18px] bg-[#f6f8fb] px-4 py-4 text-[0.96rem] leading-7 text-[#36586f]"
                >
                  <span className="mt-2 h-2.5 w-2.5 flex-none rounded-full bg-[#1d6fb8]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <aside className="rounded-[30px] border border-[#d8e2eb] bg-white p-8 text-left shadow-[0_18px_40px_rgba(18,52,79,0.08)]">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[#5f84a7]">
              Entradas principais
            </p>
            <div className="mt-5 space-y-4">
              <Link href="/escola" className="block rounded-[20px] bg-[#eef4f9] px-5 py-4">
                <strong className="block text-[1.05rem] text-[#12344f]">Escola</strong>
                <span className="mt-1 block text-[0.93rem] leading-6 text-[#5c7488]">
                  Conteudo institucional, cadastro de grupo e ingresso escolar.
                </span>
              </Link>
              <Link href="/confraternizacoes" className="block rounded-[20px] bg-[#eef4f9] px-5 py-4">
                <strong className="block text-[1.05rem] text-[#12344f]">Confraternizacoes</strong>
                <span className="mt-1 block text-[0.93rem] leading-6 text-[#5c7488]">
                  Atendimento consultivo para empresas e eventos corporativos.
                </span>
              </Link>
              <Link href="/agenda" className="block rounded-[20px] bg-[#eef4f9] px-5 py-4">
                <strong className="block text-[1.05rem] text-[#12344f]">Agenda publica</strong>
                <span className="mt-1 block text-[0.93rem] leading-6 text-[#5c7488]">
                  Day use, ingressos e datas abertas para compra.
                </span>
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
