"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { B2cProduct } from "@/lib/b2c-catalog-defaults";
import type {
  ManagedAttraction,
  ManagedEvent,
  ManagedHomeImage,
} from "@/lib/rincao-content-store";
import { contact, segmentCards } from "@/lib/site-content";

type RincaoHomePageProps = {
  heroImages: ManagedHomeImage[];
  attractions: ManagedAttraction[];
  events: ManagedEvent[];
  products: B2cProduct[];
};

const homeStats = [
  { value: "84k", label: "metros quadrados de area" },
  { value: "6", label: "piscinas para adulto e crianca" },
  { value: "12k", label: "metros quadrados de area verde" },
  { value: "30+", label: "atracoes e atividades" },
];

const steps = [
  {
    number: "01",
    title: "Escolha a data",
    text: "Abra a agenda publica e veja os dias disponiveis para visita, compra online ou agendamento.",
  },
  {
    number: "02",
    title: "Selecione os ingressos",
    text: "Adulto, crianca e isento seguem a configuracao atual do painel e da agenda aberta.",
  },
  {
    number: "03",
    title: "Conclua o cadastro",
    text: "Entre na sua conta ou faca o cadastro rapidamente para seguir com a reserva ou a compra.",
  },
  {
    number: "04",
    title: "Receba e aproveite",
    text: "Depois do pagamento ou agendamento, seus vouchers ficam disponiveis para consulta e validacao.",
  },
];

function formatPrice(value: string) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return "0,00";
  }

  return numeric.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function resolveTicketHref(product: B2cProduct) {
  if (product.id === "ingresso-isento") {
    return "/agenda";
  }

  return "/agenda";
}

function resolveProductBadge(product: B2cProduct) {
  if (product.id === "ingresso-adulto") {
    return "Mais procurado";
  }

  if (product.id === "ingresso-isento") {
    return "Sem cobranca";
  }

  return null;
}

function resolveAttractionGridClass(index: number) {
  if (index === 0) {
    return "md:col-span-2 md:row-span-2";
  }

  return "";
}

function PanelImage({
  src,
  alt,
  className,
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
    />
  );
}

export function RincaoHomePage({
  heroImages,
  attractions,
  events,
  products,
}: RincaoHomePageProps) {
  const [heroIndex, setHeroIndex] = useState(0);
  const hasHeroImages = heroImages.length > 0;

  useEffect(() => {
    if (heroImages.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % heroImages.length);
    }, 5500);

    return () => window.clearInterval(timer);
  }, [heroImages.length]);

  const featuredProducts = products
    .filter((product) => product.type === "passport")
    .slice(0, 3);

  return (
    <div className="bg-[#f6f8fb] text-[#12344f]">
      <section
        id="inicio"
        className="relative isolate min-h-[92svh] overflow-hidden bg-[#0f2d47] pt-[92px] text-white lg:pt-[124px]"
      >
        <div className="absolute inset-0">
          {hasHeroImages ? (
            heroImages.map((image, index) => (
              <div
                key={image.id}
                className={`absolute inset-0 transition-opacity duration-700 ${
                  index === heroIndex ? "opacity-100" : "opacity-0"
                }`}
              >
                <picture className="block h-full w-full">
                  {image.mobileSrc && image.mobileSrc !== image.desktopSrc ? (
                    <source media="(max-width: 767px)" srcSet={image.mobileSrc} />
                  ) : null}
                  <PanelImage
                    src={image.desktopSrc}
                    alt={image.alt}
                    eager={index === 0}
                    className="h-full w-full object-cover object-center"
                  />
                </picture>
              </div>
            ))
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#3b6ea3_0%,#173b63_50%,#0d2234_100%)]" />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,30,48,0.38)_0%,rgba(12,30,48,0.55)_45%,rgba(8,18,28,0.82)_100%)]" />
        </div>

        <div className="relative mx-auto flex min-h-[92svh] w-[min(1240px,calc(100%-40px))] flex-col justify-center py-16">
          <div className="max-w-[780px]">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/18 bg-white/8 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-white/82 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-[#d99f55]" />
              Day use, grupos e eventos
            </div>

            <h1 className="mt-6 max-w-[760px] font-[var(--font-salsa)] text-[clamp(2.8rem,7vw,5.8rem)] leading-[0.92] text-white">
              O Clube Rincao para viver um dia inteiro de lazer, natureza e grupo.
            </h1>

            <p className="mt-6 max-w-[620px] text-[1rem] leading-8 text-white/78 md:text-[1.08rem]">
              A home segue o painel: banners, atracoes e eventos publicados aparecem aqui.
              A compra continua ligada a agenda aberta e aos ingressos configurados no site.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/agenda" className="rincao-button min-w-[210px] bg-[#d99f55] hover:bg-[#c4883b]">
                Comprar ingressos
              </Link>
              <Link href="/servicos" className="rincao-button-secondary min-w-[210px] border-white/20 bg-white/10 text-white hover:border-white/35 hover:bg-white/14">
                Ver segmentos e pacotes
              </Link>
            </div>
          </div>

          <div className="mt-12 grid gap-3 rounded-[26px] border border-white/14 bg-white/10 p-3 backdrop-blur md:grid-cols-[1.1fr_1fr_1fr_auto]">
            <div className="rounded-[18px] border border-white/10 bg-white/6 px-5 py-4 text-left">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/62">
                Agenda publica
              </p>
              <p className="mt-2 text-[1rem] font-semibold text-white">
                Escolha a data disponivel
              </p>
              <p className="mt-1 text-[0.92rem] text-white/68">
                As datas abertas seguem a agenda operada no painel.
              </p>
            </div>

            <div className="rounded-[18px] border border-white/10 bg-white/6 px-5 py-4 text-left">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/62">
                Ingressos
              </p>
              <p className="mt-2 text-[1rem] font-semibold text-white">
                Adulto, crianca e isento
              </p>
              <p className="mt-1 text-[0.92rem] text-white/68">
                Os tres tipos fixos ficam unificados na jornada atual.
              </p>
            </div>

            <div className="rounded-[18px] border border-white/10 bg-white/6 px-5 py-4 text-left">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/62">
                Pagamento
              </p>
              <p className="mt-2 text-[1rem] font-semibold text-white">
                Site ou bilheteria
              </p>
              <p className="mt-1 text-[0.92rem] text-white/68">
                Compra online ou agendamento com conclusao presencial.
              </p>
            </div>

            <Link
              href="/agenda"
              className="flex min-h-[96px] items-center justify-center rounded-[18px] bg-[#d99f55] px-6 text-center text-[0.95rem] font-extrabold text-white shadow-[0_18px_32px_rgba(217,159,85,0.26)] transition hover:bg-[#c4883b]"
            >
              Ver disponibilidade
            </Link>
          </div>

          {heroImages.length > 1 ? (
            <div className="mt-6 flex items-center gap-2">
              {heroImages.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  aria-label={`Abrir banner ${index + 1}`}
                  onClick={() => setHeroIndex(index)}
                  className={`h-2.5 rounded-full transition-all ${
                    index === heroIndex
                      ? "w-10 bg-[#d99f55]"
                      : "w-2.5 bg-white/55 hover:bg-white/78"
                  }`}
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="bg-[#12344f] px-5 py-10 text-white">
        <div className="mx-auto grid max-w-[1240px] gap-4 md:grid-cols-4">
          {homeStats.map((item) => (
            <article
              key={item.label}
              className="rounded-[22px] border border-white/10 bg-white/6 px-5 py-6 text-left"
            >
              <p className="font-[var(--font-salsa)] text-[2.2rem] leading-none text-[#d99f55]">
                {item.value}
              </p>
              <p className="mt-3 text-[0.95rem] leading-6 text-white/72">{item.label}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="atracoes" className="px-5 py-18 scroll-mt-[110px] md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-[660px] text-left">
              <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[#5f84a7]">
                Atracoes do parque
              </p>
              <h2 className="mt-3 font-[var(--font-salsa)] text-[clamp(2.1rem,4vw,3.8rem)] leading-[0.98] text-[#12344f]">
                A estrutura publica acompanha o que o painel publica.
              </h2>
            </div>
            <p className="max-w-[420px] text-left text-[0.98rem] leading-7 text-[#5c7488]">
              As imagens e descricoes abaixo sao puxadas das atracoes ativas do site, sem
              depender de bloco fixo no codigo.
            </p>
          </div>

          {attractions.length === 0 ? (
            <div className="mt-10 rounded-[28px] border border-[#d8e2eb] bg-white px-8 py-12 text-left shadow-[0_20px_48px_rgba(18,52,79,0.08)]">
              <h3 className="text-[1.5rem] font-bold text-[#12344f]">Nenhuma atracao publicada</h3>
              <p className="mt-3 max-w-[640px] text-[0.98rem] leading-7 text-[#5c7488]">
                Quando a equipe publicar atracoes no painel, elas aparecem automaticamente nesta vitrine.
              </p>
            </div>
          ) : (
            <div className="mt-10 grid gap-5 md:grid-cols-4 md:auto-rows-[220px]">
              {attractions.slice(0, 5).map((attraction, index) => (
                <article
                  key={attraction.id}
                  className={`group relative overflow-hidden rounded-[28px] bg-[#12344f] shadow-[0_20px_48px_rgba(18,52,79,0.12)] ${resolveAttractionGridClass(index)}`}
                >
                  <PanelImage
                    src={attraction.imageSrc}
                    alt={attraction.title}
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,24,37,0.08)_0%,rgba(9,24,37,0.72)_70%,rgba(9,24,37,0.88)_100%)]" />
                  <div className="relative flex h-full flex-col justify-end p-6 text-left">
                    {index === 0 ? (
                      <span className="mb-3 inline-flex w-fit rounded-full bg-[#d99f55] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                        Destaque
                      </span>
                    ) : null}
                    <h3 className={`font-bold text-white ${index === 0 ? "text-[1.8rem]" : "text-[1.2rem]"}`}>
                      {attraction.title}
                    </h3>
                    <p className="mt-3 max-w-[520px] text-[0.94rem] leading-6 text-white/80">
                      {attraction.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="ingressos" className="bg-[#eef4f9] px-5 py-18 scroll-mt-[110px] md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <div className="max-w-[720px] text-left">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[#5f84a7]">
              Ingressos ativos
            </p>
            <h2 className="mt-3 font-[var(--font-salsa)] text-[clamp(2rem,4vw,3.6rem)] leading-[0.98] text-[#12344f]">
              Os tipos de ingresso seguem a configuracao atual do painel.
            </h2>
            <p className="mt-4 text-[0.98rem] leading-7 text-[#5c7488]">
              A bilheteria e o site hoje trabalham com os tipos unificados adulto, crianca e isento.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {featuredProducts.map((product) => {
              const highlighted = product.id === "ingresso-adulto";
              const badge = resolveProductBadge(product);

              return (
                <article
                  key={product.id}
                  className={`relative overflow-hidden rounded-[28px] border p-8 text-left shadow-[0_20px_48px_rgba(18,52,79,0.08)] ${
                    highlighted
                      ? "border-[#d99f55] bg-[#12344f] text-white"
                      : "border-[#d8e2eb] bg-white"
                  }`}
                >
                  {badge ? (
                    <span className="absolute right-5 top-5 rounded-full bg-[#d99f55] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
                      {badge}
                    </span>
                  ) : null}
                  <p className={`text-[11px] font-bold uppercase tracking-[0.2em] ${highlighted ? "text-white/58" : "text-[#6c8396]"}`}>
                    {product.subtitle}
                  </p>
                  <h3 className={`mt-3 text-[2rem] font-bold ${highlighted ? "text-white" : "text-[#12344f]"}`}>
                    {product.title}
                  </h3>
                  <p className={`mt-3 text-[0.95rem] leading-7 ${highlighted ? "text-white/76" : "text-[#5c7488]"}`}>
                    {product.description}
                  </p>
                  <div className="mt-6 flex items-end gap-2">
                    <span className={`text-[0.95rem] font-semibold ${highlighted ? "text-white/72" : "text-[#5c7488]"}`}>
                      R$
                    </span>
                    <span className={`font-[var(--font-salsa)] text-[3rem] leading-none ${highlighted ? "text-[#d99f55]" : "text-[#12344f]"}`}>
                      {formatPrice(product.sitePrice)}
                    </span>
                  </div>
                  <p className={`mt-2 text-[0.88rem] ${highlighted ? "text-white/58" : "text-[#6c8396]"}`}>
                    Bilheteria: R$ {formatPrice(product.boxOfficePrice)}
                  </p>
                  <Link
                    href={resolveTicketHref(product)}
                    className={`mt-8 inline-flex min-h-[50px] min-w-[190px] items-center justify-center rounded-full px-6 text-[0.95rem] font-extrabold transition ${
                      highlighted
                        ? "bg-[#d99f55] text-white hover:bg-[#c4883b]"
                        : "bg-[#1d6fb8] text-white hover:bg-[#155990]"
                    }`}
                  >
                    Ir para agenda
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="servicos" className="px-5 py-18 scroll-mt-[110px] md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-[700px] text-left">
              <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[#5f84a7]">
                Segmentos de atendimento
              </p>
              <h2 className="mt-3 font-[var(--font-salsa)] text-[clamp(2rem,4vw,3.6rem)] leading-[0.98] text-[#12344f]">
                Paginas para escola, confraternizacoes, grupos e atendimento institucional.
              </h2>
            </div>
            <Link href="/servicos" className="rincao-button-secondary w-fit">
              Abrir pagina completa de servicos
            </Link>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {segmentCards.map((segment) => (
              <article
                key={segment.href}
                className="rounded-[26px] border border-[#d8e2eb] bg-white p-6 text-left shadow-[0_20px_48px_rgba(18,52,79,0.08)]"
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

      <section id="eventos" className="bg-[#12344f] px-5 py-18 scroll-mt-[110px] text-white md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-[700px] text-left">
              <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-white/58">
                Eventos publicados
              </p>
              <h2 className="mt-3 font-[var(--font-salsa)] text-[clamp(2rem,4vw,3.4rem)] leading-[0.98] text-white">
                A vitrine de eventos tambem responde ao painel.
              </h2>
            </div>
            <Link
              href="/agenda"
              className="rincao-button-secondary w-fit border-white/14 bg-white/10 text-white hover:border-white/24 hover:bg-white/14"
            >
              Ver agenda publica
            </Link>
          </div>

          {events.length === 0 ? (
            <div className="mt-10 rounded-[28px] border border-white/10 bg-white/6 px-8 py-12 text-left">
              <h3 className="text-[1.45rem] font-bold text-white">Nenhum evento em destaque</h3>
              <p className="mt-3 max-w-[640px] text-[0.98rem] leading-7 text-white/72">
                Quando a equipe publicar eventos pelo painel, eles aparecem aqui com imagem, descricao e CTA.
              </p>
            </div>
          ) : (
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {events.slice(0, 3).map((event) => (
                <article
                  key={event.id}
                  className="overflow-hidden rounded-[28px] border border-white/10 bg-white text-left text-[#12344f] shadow-[0_24px_50px_rgba(5,15,24,0.18)]"
                >
                  <div className="relative h-[240px] overflow-hidden bg-[#dbe6f0]">
                    <PanelImage
                      src={event.imageSrc}
                      alt={event.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="text-[1.55rem] font-bold text-[#12344f]">{event.title}</h3>
                    <p className="mt-3 text-[0.95rem] leading-7 text-[#5c7488]">
                      {event.description}
                    </p>
                    <Link href={event.href} className="rincao-button mt-6 min-w-[200px]">
                      {event.buttonLabel || "Abrir evento"}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="px-5 py-18 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <div className="max-w-[680px] text-left">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[#5f84a7]">
              Como funciona
            </p>
            <h2 className="mt-3 font-[var(--font-salsa)] text-[clamp(2rem,4vw,3.4rem)] leading-[0.98] text-[#12344f]">
              O fluxo do site continua conectado a agenda, compra e atendimento.
            </h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {steps.map((step) => (
              <article
                key={step.number}
                className="rounded-[26px] border border-[#d8e2eb] bg-white p-6 text-left shadow-[0_18px_40px_rgba(18,52,79,0.08)]"
              >
                <p className="font-[var(--font-salsa)] text-[3rem] leading-none text-[#d8e2eb]">
                  {step.number}
                </p>
                <h3 className="mt-4 text-[1.22rem] font-bold text-[#12344f]">{step.title}</h3>
                <p className="mt-3 text-[0.95rem] leading-7 text-[#5c7488]">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(135deg,#1d6fb8_0%,#12344f_100%)] px-5 py-16 text-white">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-6 rounded-[30px] border border-white/10 bg-white/8 px-8 py-10 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="max-w-[720px] text-left">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-white/64">
              Atendimento do clube
            </p>
            <h2 className="mt-3 font-[var(--font-salsa)] text-[clamp(2rem,4vw,3.4rem)] leading-[0.98] text-white">
              Precisa montar uma visita em grupo ou falar com a equipe?
            </h2>
            <p className="mt-4 text-[0.98rem] leading-7 text-white/78">
              Escolas, empresas, igrejas, ONGs e grupos mistos continuam com paginas e formulários dedicados.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:min-w-[260px]">
            <a
              href={contact.whatsapp}
              target="_blank"
              rel="noreferrer"
              className="rincao-button min-h-[52px] justify-center bg-[#d99f55] hover:bg-[#c4883b]"
            >
              Falar no WhatsApp
            </a>
            <Link
              href="/grupo-escola"
              className="rincao-button-secondary min-h-[52px] justify-center border-white/16 bg-white/10 text-white hover:border-white/24 hover:bg-white/14"
            >
              Cadastrar grupo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
