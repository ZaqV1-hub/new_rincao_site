"use client";

import Image from "next/image";

const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  "Clube Rincão Av. do Jaceguava 2222 São Paulo SP",
)}`;

const busRoute = [
  {
    image: null,
    step: "1",
    title: "Pegar ônibus até o Terminal Varginha.",
  },
  {
    image: null,
    step: "2",
    title: "Descer dentro do Terminal Varginha.",
  },
  {
    image: "/location/route-3.png",
    step: "3",
    title: "Pegar o micro-ônibus (Messiânica) dentro do Terminal Varginha.",
  },
];

const metroRoute = [
  {
    image: null,
    step: "1",
    title:
      "Chegar pela Linha Esmeralda da CPTM, descer na Estação Grajaú e seguir de ônibus até o Terminal Varginha.",
  },
  {
    image: null,
    step: "2",
    title: "Descer dentro do Terminal Varginha.",
  },
  {
    image: "/location/route-3.png",
    step: "3",
    title: "Pegar o micro-ônibus (Messiânica) dentro do Terminal Varginha.",
  },
];

const finalNote =
  "Descer no ponto da Escola Cattony, ao lado do clube, com entrada pelo portão 3. Avise o motorista que você vai descer nesse ponto, porque o micro-ônibus é circular.";

function RouteStepCard({
  step,
}: {
  step: {
    image: string | null;
    step: string;
    title: string;
  };
}) {
  return (
    <article className="rounded-[24px] border border-[#d7e3ec] bg-white p-5 shadow-[0_18px_36px_rgba(18,52,79,0.08)]">
      {step.image ? (
        <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-[18px] bg-[#edf4f9]">
          <Image
            src={step.image}
            alt={step.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        </div>
      ) : (
        <div className="mb-4 flex h-[180px] items-center justify-center rounded-[18px] bg-[linear-gradient(180deg,#edf5fb_0%,#f8fbfd_100%)]">
          <div className="legacy-rounded grid h-20 w-20 place-items-center rounded-full bg-[#1d6fb8] text-[2rem] text-white shadow-[0_12px_30px_rgba(29,111,184,0.24)]">
            {step.step}
          </div>
        </div>
      )}
      <p className="text-[1rem] leading-7 text-[#294b63]">{step.title}</p>
    </article>
  );
}

function RouteSection({
  id,
  eyebrow,
  title,
  steps,
}: {
  id: string;
  eyebrow: string;
  title: string;
  steps: typeof busRoute;
}) {
  return (
    <section id={id} className="scroll-mt-[120px]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="legacy-rounded text-[12px] uppercase tracking-[0.24em] text-[#5f84a7]">
            {eyebrow}
          </p>
          <h2 className="legacy-rounded mt-3 text-[2rem] leading-tight text-[#12344f] md:text-[2.5rem]">
            {title}
          </h2>
        </div>
        <p className="max-w-[420px] text-[0.98rem] leading-7 text-[#5f7688]">
          Siga o roteiro abaixo e finalize o trajeto no ponto da Escola Cattony, ao lado
          do clube.
        </p>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[repeat(3,minmax(0,1fr))_320px]">
        {steps.map((step) => (
          <RouteStepCard key={`${id}-${step.step}`} step={step} />
        ))}

        <aside className="rounded-[24px] border border-[#d7e3ec] bg-[linear-gradient(180deg,#f8fbfd_0%,#eef5fa_100%)] p-6 shadow-[0_18px_36px_rgba(18,52,79,0.08)]">
          <p className="legacy-rounded text-[12px] uppercase tracking-[0.22em] text-[#6f8aa0]">
            Atenção final
          </p>
          <p className="mt-4 text-[1.02rem] leading-8 text-[#234660]">{finalNote}</p>
          <p className="mt-4 text-[0.95rem] leading-7 text-[#5f7688]">
            Obs.: avise o motorista para descer no ponto correto, porque o micro-ônibus é
            circular.
          </p>
        </aside>
      </div>
    </section>
  );
}

export function LocationPage() {
  return (
    <section className="bg-[#f6f8fb] text-[#12344f]">
      <div className="relative isolate overflow-hidden border-b border-[#d9e4ec] bg-[linear-gradient(135deg,#0f3552_0%,#1f5f90_55%,#2f86c7_100%)]">
        <div className="absolute inset-0 opacity-20">
          <Image
            src="/photos/day-use.jpg"
            alt=""
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_42%)]" />

        <div className="relative mx-auto flex w-[min(1240px,calc(100%-32px))] flex-col gap-8 py-16 md:py-20">
          <div className="max-w-[760px]">
            <p className="legacy-rounded text-[12px] uppercase tracking-[0.3em] text-white/70">
              Acesso
            </p>
            <h1 className="legacy-rounded mt-4 text-[clamp(2.8rem,7vw,5rem)] leading-[0.95] text-white">
              Localização
            </h1>
            <p className="mt-6 max-w-[660px] text-[1.05rem] leading-8 text-[#dceaf4]">
              Veja o endereço do Clube Rincão, abra o mapa do Google e siga os roteiros de
              ônibus ou metrô/trem com o visual atualizado do site.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div className="rounded-[28px] border border-white/12 bg-white/10 p-6 backdrop-blur-[6px]">
              <p className="legacy-rounded text-[12px] uppercase tracking-[0.24em] text-white/65">
                Endereço do clube
              </p>
              <h2 className="legacy-rounded mt-3 text-[1.8rem] text-white">
                Av. do Jaceguava, 2.222
              </h2>
              <p className="mt-3 text-[1rem] leading-8 text-[#e4f0f8]">
                Jardim Casa Grande, São Paulo - SP, CEP 04870-020.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:max-w-[420px] lg:ml-auto lg:w-full lg:max-w-[560px] lg:grid-cols-3">
              <a
                href="#roteiro-metro"
                className="inline-flex min-h-[56px] items-center justify-center rounded-full border border-white/20 bg-white px-5 text-center text-[0.96rem] font-bold leading-tight text-[#1d5b80] shadow-[0_14px_30px_rgba(8,36,58,0.14)] transition hover:bg-[#f3f8fc] max-sm:col-span-2 lg:min-h-[52px] lg:px-6"
              >
                Roteiro Metrô / Trem
              </a>
              <a
                href="#roteiro-onibus"
                className="inline-flex min-h-[56px] items-center justify-center rounded-full border border-white/20 bg-white px-5 text-center text-[0.96rem] font-bold leading-tight text-[#1d5b80] shadow-[0_14px_30px_rgba(8,36,58,0.14)] transition hover:bg-[#f3f8fc] lg:min-h-[52px] lg:px-6"
              >
                Roteiro Ônibus
              </a>
              <a
                href={googleMapsLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[56px] items-center justify-center rounded-full bg-[#d99f55] px-5 text-center text-[0.96rem] font-bold leading-tight text-white shadow-[0_14px_30px_rgba(217,159,85,0.3)] transition hover:bg-[#c88a39] lg:min-h-[52px] lg:px-6"
              >
                Ver Mapa
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-[min(1240px,calc(100%-32px))] py-10 md:py-14">
        <section className="rounded-[30px] border border-[#d7e3ec] bg-white p-4 shadow-[0_24px_48px_rgba(18,52,79,0.08)] md:p-6">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="legacy-rounded text-[12px] uppercase tracking-[0.24em] text-[#5f84a7]">
                Mapa
              </p>
              <h2 className="legacy-rounded mt-3 text-[2rem] text-[#12344f]">
                Como chegar ao Clube Rincão
              </h2>
            </div>
            <p className="max-w-[420px] text-[0.98rem] leading-7 text-[#5f7688]">
              O mapa do Google continua disponível normalmente para navegação, consulta e
              abertura externa.
            </p>
          </div>

          <div className="overflow-hidden rounded-[24px] bg-[#edf4f9]">
            <iframe
              title="Mapa Rincao"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d10114.54023873911!2d-46.747566408833706!3d-23.77692536125703!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ce4eacb5029f0b%3A0x3023a922486787e9!2sClube+Rinc%C3%A3o!5e0!3m2!1spt-BR!2sbr!4v1455706557119"
              className="h-[320px] w-full md:h-[520px]"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </section>

        <div className="mt-12 space-y-12 md:mt-16 md:space-y-16">
          <RouteSection
            id="roteiro-onibus"
            eyebrow="Rota urbana"
            title="Roteiro de Ônibus"
            steps={busRoute}
          />

          <RouteSection
            id="roteiro-metro"
            eyebrow="Rota integrada"
            title="Roteiro Metrô / Trem"
            steps={metroRoute}
          />
        </div>
      </div>
    </section>
  );
}
