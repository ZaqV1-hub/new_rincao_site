"use client";

import { contact } from "@/lib/site-content";

const careersWhatsApp = "https://wa.me/5511950741533";

export function CareersPage() {
  return (
    <section className="w-full">
      <div
        className="relative top-[-10px] mb-[15px] h-[265px] w-full bg-cover bg-center bg-no-repeat max-md:top-0 max-md:mb-3 max-md:h-[220px]"
        style={{ backgroundImage: "url('/photos/escola.jpg')" }}
      >
        <div
          className="absolute left-0 top-[160px] h-[130px] w-full bg-left-top bg-no-repeat pt-[36px] pl-5 text-left max-md:top-[108px] max-md:h-[112px] max-md:bg-[length:auto_112px] max-md:pt-[30px] max-md:pl-[18px]"
          style={{ backgroundImage: "url('/theme/color-bar-3.png')" }}
        >
          <h1 className="legacy-condensed text-[30px] leading-none text-white drop-shadow-[2px_2px_5px_rgba(0,0,0,0.4)]">
            Trabalhe Conosco
          </h1>
        </div>
      </div>

      <div className="site-page-shell">
        <div className="grid gap-8 md:grid-cols-[280px_1fr]">
          <div className="text-left">
            <a
              href={careersWhatsApp}
              target="_blank"
              rel="noreferrer"
              className="legacy-rounded inline-flex rounded-[5px] bg-[#3498db] px-5 py-3 text-[16px] text-white hover:bg-[#2980b9]"
            >
              Enviar Currículo
            </a>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="text-left">
              <div className="mb-4">
                <strong className="legacy-condensed block text-[14px] uppercase text-[#155188]">
                  Telefones
                </strong>
                {contact.phones.map((phone) => (
                  <a
                    key={phone}
                    href={`tel:${phone.replace(/[^\d]/g, "")}`}
                    className="block text-[16px] text-[#666]"
                  >
                    {phone}
                  </a>
                ))}
              </div>

              <div>
                <strong className="legacy-condensed block text-[14px] uppercase text-[#155188]">
                  Endereço
                </strong>
                <address className="not-italic text-[16px] text-[#666]">
                  Av. do Jaceguava, 2.222 - Jardim Casa Grande - São Paulo - SP / CEP: 04.870-020
                </address>
                <a
                  href="/localizacao"
                  className="legacy-button mt-3"
                >
                  ver mapa ampliado
                </a>
              </div>
            </div>

            <div className="overflow-hidden rounded bg-[#eaeaea]">
              <iframe
                title="Mapa Estancia"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d10114.54023873911!2d-46.747566408833706!3d-23.77692536125703!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ce4eacb5029f0b%3A0x3023a922486787e9!2sClube+Rinc%C3%A3o!5e0!3m2!1spt-BR!2sbr!4v1455706557119"
                className="h-[280px] w-full md:h-[360px]"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-[1fr_360px]">
          <div className="site-page-card text-left">
            <h2 className="site-page-heading">Envie seu currículo</h2>
            <p className="site-page-copy mt-3">
              Para trabalhar conosco, envie seu currículo pelo WhatsApp oficial e informe seu nome, bairro, área de interesse e experiência principal.
            </p>
            <p className="site-page-copy mt-3">
              Se preferir, você também pode tirar dúvidas pelos telefones do clube antes do envio. O atendimento institucional segue disponível para orientar o melhor canal de contato.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href={careersWhatsApp} target="_blank" rel="noreferrer" className="legacy-button green">
                Enviar currículo
              </a>
              <a href={`tel:${contact.phones[0].replace(/[^\d]/g, "")}`} className="legacy-button">
                ligar para o clube
              </a>
            </div>
          </div>

          <aside className="site-page-card text-left">
            <h2 className="site-page-panel-title">
              Informações Rápidas
            </h2>
            <div className="mt-4 space-y-4">
              <div>
                <strong className="legacy-condensed block text-[22px] text-[#3393d6]">
                  Telefone 1
                </strong>
                <span className="text-[13px] leading-6 text-[#333]">{contact.phones[0]}</span>
              </div>
              <div>
                <strong className="legacy-condensed block text-[22px] text-[#3393d6]">
                  Telefone 2
                </strong>
                <span className="text-[13px] leading-6 text-[#333]">{contact.phones[1]}</span>
              </div>
              <div>
                <strong className="legacy-condensed block text-[22px] text-[#3393d6]">
                  Telefone 3
                </strong>
                <span className="text-[13px] leading-6 text-[#333]">{contact.phones[2]}</span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <a href={careersWhatsApp} target="_blank" rel="noreferrer" className="legacy-button green text-center">
                Enviar currículo
              </a>
              <a href="/localizacao" className="legacy-button text-center">
                ver mapa ampliado
              </a>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
