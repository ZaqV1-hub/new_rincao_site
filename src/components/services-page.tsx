"use client";

import Image from "next/image";
import Link from "next/link";

const services = [
  {
    title: "Day-Use Família",
    href: "/day-camp",
    iconSrc: "/segments/familia.png",
    accent: true,
  },
  {
    title: "Melhor Idade",
    href: "/melhor-idade",
    iconSrc: "/segments/melhor-idade.png",
  },
  {
    title: "Escola",
    href: "/escola",
    iconSrc: "/segments/escola.png",
  },
  {
    title: "Igreja",
    href: "/igreja",
    iconSrc: "/segments/igreja.png",
  },
  {
    title: "ONG's",
    href: "/ongs",
    iconSrc: "/segments/ong.png",
  },
  {
    title: "Grupos Mistos",
    href: "/melhor-idade-grupos-mistos",
    iconSrc: "/segments/misto.png",
  },
];

const gallery = [
  { src: "/services/gallery-1.jpeg", alt: "Piscina do Estancia", className: "col-span-4 aspect-[16/8]" },
  { src: "/services/gallery-2.jpg", alt: "Vista aérea do Estancia", className: "col-span-2 aspect-[16/10]" },
  { src: "/services/gallery-3.jpeg", alt: "Estrutura de lazer do clube", className: "col-span-2 aspect-[16/10]" },
  { src: "/services/gallery-4.jpg", alt: "Toboágua do Estancia", className: "col-span-2 aspect-[16/10]" },
  { src: "/services/gallery-5.jpg", alt: "Família aproveitando a piscina", className: "col-span-1 aspect-square" },
  { src: "/services/gallery-6.jpg", alt: "Visitantes curtindo o parque", className: "col-span-1 aspect-square" },
  { src: "/services/gallery-7.jpg", alt: "Área verde do Estancia", className: "col-span-2 aspect-[16/7]" },
];

export function ServicesPage() {
  return (
    <section className="w-full">
      <div
        className="relative top-[-10px] mb-[15px] h-[265px] w-full bg-cover bg-center bg-no-repeat max-md:top-0 max-md:mb-3 max-md:h-[220px]"
        style={{ backgroundImage: "url('/service-hero.jpg')" }}
      >
        <div
          className="absolute left-0 top-[160px] h-[130px] w-full bg-left-top bg-no-repeat pt-[36px] pl-5 text-left max-md:top-[108px] max-md:h-[112px] max-md:bg-[length:auto_112px] max-md:pt-[30px] max-md:pl-[18px]"
          style={{ backgroundImage: "url('/theme/color-bar-3.png')" }}
        >
          <h1 className="legacy-condensed text-[30px] leading-none text-white drop-shadow-[2px_2px_5px_rgba(0,0,0,0.4)]">
            Serviços
          </h1>
        </div>
      </div>

      <div className="site-page-shell">
        <div className="grid gap-0 lg:grid-cols-2">
          <div className="px-5 pb-8 pt-5 md:px-[30px]">
            <div className="grid grid-cols-2 gap-y-5 md:gap-y-7">
              {services.map((service) => (
                <div
                  key={service.title}
                  className="relative px-[5px] pb-2 pt-[70px] text-center"
                >
                  <div
                    className={`absolute left-1/2 top-[10px] flex h-[60px] w-[60px] -translate-x-1/2 items-center justify-center rounded-full ${
                      service.accent ? "bg-[#1f8a70]" : "bg-[#705535]"
                    }`}
                  >
                    <Image
                      src={service.iconSrc}
                      alt={service.title}
                      width={36}
                      height={36}
                      className="object-contain"
                    />
                  </div>
                  <strong
                    className={`legacy-condensed inline-block text-[22px] leading-[20px] md:text-[25px] md:leading-[22px] ${
                      service.accent ? "text-[#135b49]" : "text-[#7b5f3b]"
                    }`}
                  >
                    {service.title}
                  </strong>
                  <br />
                  <Link href={service.href} className="legacy-button green">
                    saiba mais
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <div className="px-5 pb-8 pt-5 md:px-[30px]">
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
