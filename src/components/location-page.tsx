"use client";

import Image from "next/image";
import { contact } from "@/lib/site-content";

const busRoute = [
  {
    image: null,
    step: "1",
    title: "Pegar ônibus terminal Varginha",
  },
  {
    image: null,
    step: "2",
    title: "Descer dentro do Terminal Varginha",
  },
  {
    image: "/location/route-3.png",
    step: "3",
    title: "Pegar Micro-ônibus (Messiânica) dentro do Terminal Varginha",
  },
];

const metroRoute = [
  {
    image: null,
    step: "1",
    title:
      "Chegar na Linha Esmeralda da CPTM e descer na Estação Grajaú. Pegar ônibus Terminal Varginha",
  },
  {
    image: null,
    step: "2",
    title: "Descer dentro do Terminal Varginha",
  },
  {
    image: "/location/route-3.png",
    step: "3",
    title: "Pegar Micro-ônibus (Messiânica) dentro do Terminal Varginha",
  },
];

const finalNote =
  "Descer no ponto da escola Cattony que está ao lado do clube, entrada pelo portão 3. Avisar o motorista que você vai descer neste ponto porque o micro-ônibus é circular.";

export function LocationPage() {
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
            Localização
          </h1>
        </div>
      </div>

      <div className="site-page-shell">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <address className="flex items-start gap-3 not-italic text-[16px] text-[#666] md:max-w-[58%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/theme/mark.png"
              alt=""
              width={18}
              height={24}
              className="mt-1 h-auto w-[18px]"
            />
            <div>
              <strong className="legacy-condensed block text-[14px] uppercase text-[#155188]">
                Endereço
              </strong>
              Av. do Jaceguava, 2.222 - Jardim Casa Grande - São Paulo - SP / CEP: 04.870-020
            </div>
          </address>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <a href="#roteiro-metro" className="legacy-button">
              Roteiro Metrô / Trem
            </a>
            <a href="#roteiro-onibus" className="legacy-button">
              Roteiro Ônibus
            </a>
            <a href={contact.map} target="_blank" rel="noreferrer" className="legacy-button">
              Ver Mapa
            </a>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded bg-[#eaeaea]">
          <iframe
            title="Mapa Estancia"
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d10114.54023873911!2d-46.747566408833706!3d-23.77692536125703!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ce4eacb5029f0b%3A0x3023a922486787e9!2sClube+Rinc%C3%A3o!5e0!3m2!1spt-BR!2sbr!4v1455706557119"
            className="h-[320px] w-full md:h-[450px]"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        <div id="roteiro-onibus" className="mt-8">
          <h2 className="site-page-heading">
            Roteiro de Ônibus
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            {busRoute.map((step) => (
              <div key={step.title} className="rounded bg-[#f7f7f7] p-4">
                {step.image ? (
                  <div className="relative mb-3 aspect-[4/3] overflow-hidden bg-[#f0f0f0]">
                    <Image src={step.image} alt={step.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 25vw" />
                  </div>
                ) : (
                  <div className="mb-3 flex aspect-[4/3] items-center justify-center rounded bg-[#f5f7fa]">
                    <div className="legacy-condensed flex h-16 w-16 items-center justify-center rounded-full bg-[#1f6490] text-[34px] text-white">
                      {step.step}
                    </div>
                  </div>
                )}
                <h3 className="legacy-rounded text-[15px] leading-5 text-[#333]">
                  {step.title}
                </h3>
              </div>
            ))}
            <div className="rounded bg-[#efefef] p-4">
              <h3 className="legacy-rounded text-[15px] leading-5 text-[#333]">
                {finalNote}
              </h3>
              <p className="site-page-note mt-2">
                Obs: avise o motorista para descer no ponto correto, porque o micro-ônibus é circular.
              </p>
            </div>
          </div>
        </div>

        <div id="roteiro-metro" className="mt-10">
          <h2 className="site-page-heading">
            Roteiro Metrô / Trem
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            {metroRoute.map((step) => (
              <div key={step.title} className="rounded bg-[#f7f7f7] p-4">
                {step.image ? (
                  <div className="relative mb-3 aspect-[4/3] overflow-hidden bg-[#f0f0f0]">
                    <Image src={step.image} alt={step.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 25vw" />
                  </div>
                ) : (
                  <div className="mb-3 flex aspect-[4/3] items-center justify-center rounded bg-[#f5f7fa]">
                    <div className="legacy-condensed flex h-16 w-16 items-center justify-center rounded-full bg-[#1f6490] text-[34px] text-white">
                      {step.step}
                    </div>
                  </div>
                )}
                <h3 className="legacy-rounded text-[15px] leading-5 text-[#333]">
                  {step.title}
                </h3>
              </div>
            ))}
            <div className="rounded bg-[#efefef] p-4">
              <h3 className="legacy-rounded text-[15px] leading-5 text-[#333]">
                {finalNote}
              </h3>
              <p className="site-page-note mt-2">
                Obs: avise o motorista para descer no ponto correto, porque o micro-ônibus é circular.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 md:hidden">
          <div className="relative aspect-[16/9] overflow-hidden bg-[#eaeaea]">
            <Image src="/photos/day-use.jpg" alt="Estrada de acesso ao Estancia" fill className="object-cover" sizes="100vw" />
          </div>
        </div>
      </div>
    </section>
  );
}
