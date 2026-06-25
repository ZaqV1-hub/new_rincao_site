"use client";

import Image from "next/image";

const mainItems = [
  "6 piscinas sendo 3 adultas e 3 infantil com escorregadores e tendas",
  "Toboáguas de 3 pistas e toboáguas simples",
  "Playgroud aquático infantil",
  "Quadra poli-esportiva",
  "Campo de futebol society",
  "Trilha ecológica com ponte pênsil, casa do índio e mirante",
  "Playground coberto com 800mts², kid-play 2 andares coberto, camas elásticas",
  "Casa de bolinhas, 2 torres com escorregadores",
  "Mini fazenda para exposição",
  "Parque de diversão com: carrosséis, Maria Fumaça e Centopeia",
  "Barco Viking e La-bamba",
  "Passeio de trenzinho",
  "Salão de jogos",
  "Quadra de vôlei",
  "Tirolesa",
  "Casarão de antiquários",
];

const supportItems = [
  "Estacionamento com cobrança à parte",
  "Portaria com equipe de segurança interna e externa",
  "Vestiário masculino e feminino com sanitários e duchas",
  "Enfermaria",
  "Guarda-volumes",
  "Salões para refeições e reuniões",
  "Palco para shows e apresentações",
  "Amplas cozinhas equipadas (industrial)",
];

const gallery = [
  {
    src: "/structure/gallery-1.jpeg",
    alt: "Piscina do Estancia",
    className: "col-span-4 aspect-[16/8]",
  },
  {
    src: "/structure/gallery-2.jpg",
    alt: "Vista aérea da estrutura",
    className: "col-span-2 aspect-square",
  },
  {
    src: "/structure/gallery-3.jpeg",
    alt: "Toboágua do clube",
    className: "col-span-1 aspect-square",
  },
  {
    src: "/structure/gallery-4.jpg",
    alt: "Piscina com visitantes",
    className: "col-span-1 aspect-square",
  },
  {
    src: "/structure/gallery-5.jpg",
    alt: "Lago da estrutura",
    className: "col-span-2 aspect-[16/9]",
  },
  {
    src: "/structure/gallery-6.jpg",
    alt: "Famílias curtindo a água",
    className: "col-span-1 aspect-[4/5]",
  },
  {
    src: "/structure/gallery-7.jpg",
    alt: "Área verde do Estancia",
    className: "col-span-1 aspect-[4/5]",
  },
  {
    src: "/structure/gallery-8.jpg",
    alt: "Paisagem da estrutura",
    className: "col-span-2 aspect-[16/9]",
  },
  {
    src: "/structure/gallery-9.jpg",
    alt: "Piscina com escorregador",
    className: "col-span-1 aspect-square",
  },
  {
    src: "/structure/gallery-10.jpg",
    alt: "Vista do clube",
    className: "col-span-1 aspect-square",
  },
  {
    src: "/structure/gallery-11.jpg",
    alt: "Panorâmica da estrutura",
    className: "col-span-2 aspect-[16/9]",
  },
  {
    src: "/structure/gallery-12.jpg",
    alt: "Visitantes aproveitando a piscina",
    className: "col-span-1 aspect-square",
  },
  {
    src: "/structure/gallery-13.jpg",
    alt: "Área de lazer",
    className: "col-span-1 aspect-square",
  },
  {
    src: "/structure/gallery-14.jpg",
    alt: "Jardins do Estancia",
    className: "col-span-2 aspect-[16/9]",
  },
];

export function StructurePage() {
  return (
    <section className="w-full">
      <div
        className="relative top-[-10px] mb-[15px] h-[265px] w-full bg-cover bg-center bg-no-repeat max-md:top-0 max-md:mb-3 max-md:h-[220px]"
        style={{ backgroundImage: "url('/structure/hero.jpg')" }}
      >
        <div
          className="absolute left-0 top-[160px] h-[130px] w-full bg-left-top bg-no-repeat pt-[36px] pl-5 text-left max-md:top-[108px] max-md:h-[112px] max-md:bg-[length:auto_112px] max-md:pt-[30px] max-md:pl-[18px]"
          style={{ backgroundImage: "url('/theme/color-bar-3.png')" }}
        >
          <h1 className="legacy-condensed text-[30px] leading-none text-white drop-shadow-[2px_2px_5px_rgba(0,0,0,0.4)]">
            Estrutura
          </h1>
        </div>
      </div>

      <div className="site-page-shell">
        <div className="grid gap-0 lg:grid-cols-2">
          <div className="px-5 pb-8 pt-5 text-left md:px-[30px]">
            <h2 className="site-page-heading pb-5">
              Conheça nossa estrutura e venha aproveitar
            </h2>

            <ul className="mb-[10px]">
              {mainItems.map((item) => (
                <li
                  key={item}
                  className="legacy-rounded bg-[url('/theme/bullet.png')] bg-[position:left_4px] bg-no-repeat py-1 pl-[22px] text-[15px] leading-5 text-[#333]"
                >
                  {item}
                </li>
              ))}
            </ul>

            <ul className="bg-[#ece9e5] p-[15px]">
              {supportItems.map((item) => (
                <li
                  key={item}
                  className="bg-[url('/theme/bullet-2.png')] bg-[position:left_11px] bg-no-repeat py-[2px] pl-[10px] text-[13px] leading-5 text-[#333]"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="px-5 pb-8 pt-5 md:px-[30px]">
            <h2 className="site-page-panel-title relative mb-5 bg-[url('/structure/gallery-icon.png')] bg-left bg-no-repeat pl-[62px] pt-2 text-left">
              Galeria de Fotos
            </h2>

            <div className="grid grid-cols-4 gap-[10px]">
              {gallery.map((item) => (
                <div
                  key={item.src}
                  className={`relative overflow-hidden bg-[#eaeaea] ${item.className}`}
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
