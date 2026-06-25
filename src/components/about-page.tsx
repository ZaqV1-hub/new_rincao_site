"use client";

import Image from "next/image";

const paragraphs = [
  "Somos um espaço de 84 mil metros quadrados focados no lazer e tranquilidade. Localizado a 10km do autódromo de Interlagos, o Estancia conta com 12 mil metros quadrados de área de reflorestamento totalmente evidenciada pela serenidade da natureza.",
  "O clube se destaca por sua excelência nos serviços prestados, estrutura de lazer oferecida aos seus visitantes e pelo tempo de atividade no ramo de eventos e entretenimento. São 14 anos de constante aprimoramento das nossas funções e profissionais.",
  "Por isso, temos uma equipe especializada e devidamente capacitada para cuidar de cada detalhe do seu evento, proporcionando um dia inesquecível para você, sua família e seus amigos.",
];

const team = [
  {
    icon: "/about/team-icon-1.png",
    text: "Recreadores treinados em cursos de monitoria/recreação;",
  },
  {
    icon: "/about/team-icon-2.png",
    text: "Cozinheiros e auxiliares altamente qualificados;",
  },
  {
    icon: "/about/team-icon-3.png",
    text: "Gerência com ampla experiência em eventos.",
  },
];

const closing = [
  "Toda a qualidade na prestação de serviços aliada a um dos mais belos locais de contato com a natureza, faz com que o Estancia seja sua melhor opção para se divertir e relaxar.",
  "Nós da família Estancia esperamos que todas as pessoas possam desfrutar de nossa qualidade o quanto antes.",
];

const gallery = [
  {
    src: "/about/gallery-1.jpeg",
    alt: "Piscina de ondas do Estancia",
    className: "col-span-4 aspect-[16/8] md:aspect-[16/7]",
  },
  {
    src: "/about/gallery-2.jpg",
    alt: "Visitantes curtindo a estrutura do clube",
    className: "col-span-2 aspect-[16/10]",
  },
  {
    src: "/about/gallery-3.jpeg",
    alt: "Área do clube vista em foto aérea",
    className: "col-span-2 aspect-[16/10]",
  },
  {
    src: "/about/gallery-4.jpg",
    alt: "Toboágua do Estancia",
    className: "col-span-2 aspect-[16/10]",
  },
  {
    src: "/about/gallery-5.jpg",
    alt: "Lazer infantil na piscina",
    className: "col-span-1 aspect-square",
  },
  {
    src: "/about/gallery-6.jpg",
    alt: "Família aproveitando o parque",
    className: "col-span-1 aspect-square",
  },
  {
    src: "/about/gallery-7.jpg",
    alt: "Estrutura verde do Estancia",
    className: "col-span-2 aspect-[16/7]",
  },
];

export function AboutPage() {
  return (
    <section className="w-full">
      <div
        className="relative top-[-10px] mb-[15px] h-[265px] w-full bg-cover bg-center bg-no-repeat max-md:top-0 max-md:mb-3 max-md:h-[220px]"
        style={{ backgroundImage: "url('/about/hero-main.jpg')" }}
      >
        <div
          className="absolute left-0 top-[160px] h-[130px] w-full bg-left-top bg-no-repeat pt-[36px] pl-5 text-left max-md:top-[108px] max-md:h-[112px] max-md:bg-[length:auto_112px] max-md:pt-[30px] max-md:pl-[18px]"
          style={{ backgroundImage: "url('/theme/color-bar-3.png')" }}
        >
          <h1 className="legacy-condensed text-[30px] leading-none text-white drop-shadow-[2px_2px_5px_rgba(0,0,0,0.4)]">
            Quem Somos
          </h1>
        </div>
      </div>

      <div className="site-page-shell">
        <div className="grid gap-0 lg:grid-cols-2">
          <div className="px-5 pb-8 pt-5 text-left md:px-[30px]">
            {paragraphs.map((paragraph) => (
              <p key={paragraph} className="site-page-copy mb-[15px]">
                {paragraph}
              </p>
            ))}

            <h2 className="legacy-rounded px-2 pb-[10px] pt-5 text-center text-[20px] font-normal text-[#1f6490] md:text-[20px]">
              Nossa equipe é composta por:
            </h2>

            <ul className="mb-5 grid gap-4 md:grid-cols-3 md:gap-2">
              {team.map((item) => (
                <li
                  key={item.text}
                  className="legacy-condensed bg-top bg-no-repeat px-5 pt-20 text-center text-[15px] font-bold leading-[1.1] text-[#1f6490]"
                  style={{ backgroundImage: `url('${item.icon}')` }}
                >
                  {item.text}
                </li>
              ))}
            </ul>

            {closing.map((paragraph) => (
              <p key={paragraph} className="site-page-copy mb-[15px]">
                {paragraph}
              </p>
            ))}
          </div>

          <div className="px-5 pb-5 pt-5 md:px-[30px] md:pt-5">
            <div className="grid grid-cols-4 gap-3">
              {gallery.map((item) => (
                <div
                  key={item.src}
                  className={`relative overflow-hidden bg-[#e8e8e8] ${item.className}`}
                >
                  <Image
                    src={item.src}
                    alt={item.alt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
