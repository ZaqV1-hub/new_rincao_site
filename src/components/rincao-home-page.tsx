"use client";

import Link from "next/link";
import { useRef, useState, type PointerEvent } from "react";
import type {
  ManagedAttraction,
  ManagedEvent,
  ManagedHomeImage,
} from "@/lib/rincao-content-store";

type RincaoHomePageProps = {
  heroImages: ManagedHomeImage[];
  attractions: ManagedAttraction[];
  events: ManagedEvent[];
};

function moveIndex(current: number, direction: -1 | 1, length: number) {
  return (current + direction + length) % length;
}

function resolveNearestIndex(element: HTMLDivElement | null) {
  if (!element) {
    return 0;
  }

  const center = element.scrollLeft + element.clientWidth / 2;
  const children = Array.from(element.children) as HTMLElement[];
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  children.forEach((child, index) => {
    const childCenter = child.offsetLeft + child.clientWidth / 2;
    const distance = Math.abs(childCenter - center);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function scrollCarouselToIndex(element: HTMLDivElement | null, index: number) {
  if (!element) {
    return;
  }

  const child = element.children.item(index) as HTMLElement | null;

  if (!child) {
    return;
  }

  child.scrollIntoView({
    behavior: "smooth",
    inline: "center",
    block: "nearest",
  });
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={3}
    >
      {direction === "left" ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19l-7-7 7-7"
        />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      )}
    </svg>
  );
}

function shouldIgnoreCarouselPointer(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest("a, button, input, textarea, select, label"))
  );
}

function HeroBannerImage({
  image,
  active,
  preload,
}: {
  image: ManagedHomeImage;
  active: boolean;
  preload: boolean;
}) {
  const mobileSrc = image.mobileSrc?.trim() || image.desktopSrc;

  return (
    <div
      className={`absolute inset-0 transition-opacity duration-300 ${
        active ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <picture className="block h-full w-full">
        {mobileSrc !== image.desktopSrc ? (
          <source media="(max-width: 767px)" srcSet={mobileSrc} />
        ) : null}
        <img
          src={image.desktopSrc}
          alt={image.alt}
          className="block h-full w-full object-cover object-center"
          loading={preload ? "eager" : "lazy"}
          fetchPriority={preload ? "high" : "auto"}
          draggable={false}
        />
      </picture>
    </div>
  );
}

function AttractionCard({
  attraction,
  featured,
}: {
  attraction: ManagedAttraction;
  featured?: boolean;
}) {
  return (
    <article
      className={`group relative overflow-hidden rounded-[34px] bg-[#12344f] ${
        featured ? "min-h-[430px]" : "min-h-[205px]"
      }`}
    >
      <img
        src={attraction.imageSrc}
        alt={attraction.title}
        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        loading="lazy"
        draggable={false}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,22,35,0.08)_0%,rgba(6,22,35,0.26)_38%,rgba(6,22,35,0.9)_100%)]" />
      <div className="relative flex h-full flex-col justify-end p-6 text-white md:p-7">
        {featured ? (
          <span className="mb-4 inline-flex w-fit rounded-full bg-[#e2a74b] px-4 py-2 text-[0.72rem] font-black uppercase tracking-[0.22em] text-white">
            Destaque
          </span>
        ) : null}
        <h3 className="text-[1.9rem] font-bold leading-none md:text-[2.3rem]">
          {attraction.title}
        </h3>
        <p className="mt-4 max-w-[560px] text-[0.98rem] leading-7 text-white/78">
          {attraction.description}
        </p>
      </div>
    </article>
  );
}

function EventCard({ event }: { event: ManagedEvent }) {
  return (
    <article className="overflow-hidden rounded-[34px] bg-white shadow-[0_24px_48px_rgba(6,33,61,0.14)]">
      <Link href={event.href} className="block overflow-hidden" aria-label={event.title}>
        <img
          src={event.imageSrc}
          alt={event.title}
          className="block h-[260px] w-full object-cover transition duration-500 hover:scale-[1.03]"
          loading="lazy"
          draggable={false}
        />
      </Link>
      <div className="p-6 text-left md:p-7">
        <h3 className="text-[2rem] font-bold leading-none text-[#12344f]">
          {event.title}
        </h3>
        <p className="mt-4 text-[1rem] leading-7 text-[#567085]">
          {event.description}
        </p>
        <Link href={event.href} className="rincao-button mt-6 inline-flex">
          {event.buttonLabel}
        </Link>
      </div>
    </article>
  );
}

export function RincaoHomePage({
  heroImages,
  attractions,
  events,
}: RincaoHomePageProps) {
  const hasHeroImages = heroImages.length > 0;
  const [heroIndex, setHeroIndex] = useState(0);
  const [eventIndex, setEventIndex] = useState(0);
  const heroDragRef = useRef<{
    pointerId: number;
    startX: number;
    deltaX: number;
  } | null>(null);
  const eventsRef = useRef<HTMLDivElement>(null);
  const carouselDragRef = useRef<{
    element: HTMLDivElement;
    x: number;
    scrollLeft: number;
  } | null>(null);

  function handleHeroPointerDown(event: PointerEvent<HTMLElement>) {
    if (!hasHeroImages) {
      return;
    }

    heroDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      deltaX: 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleHeroPointerMove(event: PointerEvent<HTMLElement>) {
    if (!hasHeroImages) {
      return;
    }

    if (
      !heroDragRef.current ||
      heroDragRef.current.pointerId !== event.pointerId
    ) {
      return;
    }

    heroDragRef.current.deltaX = event.clientX - heroDragRef.current.startX;
  }

  function handleHeroPointerUp(event: PointerEvent<HTMLElement>) {
    if (!hasHeroImages) {
      return;
    }

    if (
      !heroDragRef.current ||
      heroDragRef.current.pointerId !== event.pointerId
    ) {
      return;
    }

    const distance = heroDragRef.current.deltaX;
    heroDragRef.current = null;

    if (Math.abs(distance) < 34) {
      return;
    }

    setHeroIndex((current) =>
      moveIndex(current, distance < 0 ? 1 : -1, heroImages.length),
    );
  }

  function handleCarouselPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (shouldIgnoreCarouselPointer(event.target)) {
      carouselDragRef.current = null;
      return;
    }

    carouselDragRef.current = {
      element: event.currentTarget,
      x: event.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleCarouselPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = carouselDragRef.current;

    if (!drag || drag.element !== event.currentTarget) {
      return;
    }

    event.currentTarget.scrollLeft = drag.scrollLeft - (event.clientX - drag.x);
  }

  function handleCarouselPointerEnd() {
    carouselDragRef.current = null;
  }

  function moveEvent(direction: -1 | 1) {
    const nextIndex = Math.min(
      Math.max(eventIndex + direction, 0),
      events.length - 1,
    );
    setEventIndex(nextIndex);
    scrollCarouselToIndex(eventsRef.current, nextIndex);
  }

  const featuredAttraction = attractions[0];
  const secondaryAttractions = attractions.slice(1, 3);

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-[#12344f]">
      <section
        id="inicio"
        onPointerDown={handleHeroPointerDown}
        onPointerMove={handleHeroPointerMove}
        onPointerUp={handleHeroPointerUp}
        onPointerCancel={() => {
          heroDragRef.current = null;
        }}
        className="relative h-[68svh] min-h-[460px] scroll-mt-[82px] overflow-hidden bg-[#12344f] lg:scroll-mt-[108px]"
      >
        {hasHeroImages ? (
          <>
            <div className="absolute inset-0">
              {heroImages.map((image, index) => (
                <HeroBannerImage
                  key={image.id}
                  image={image}
                  active={index === heroIndex}
                  preload={index === 0}
                />
              ))}
            </div>
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,23,38,0.12)_0%,rgba(8,23,38,0.28)_100%)]" />
            <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
              {heroImages.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  aria-label={`Ver imagem ${index + 1}`}
                  onClick={() => setHeroIndex(index)}
                  className={`h-2.5 rounded-full bg-white/90 transition-all ${
                    index === heroIndex ? "w-9" : "w-2.5 opacity-60"
                  }`}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#3b6ea3_0%,#173b63_50%,#0d2234_100%)]" />
        )}
      </section>

      <main>
        <section
          id="atracoes"
          className="scroll-mt-[96px] px-5 py-16 md:py-20 lg:scroll-mt-[132px]"
        >
          <div className="mx-auto max-w-[1240px]">
            <div className="mb-10 text-left">
              <p className="text-[12px] font-bold uppercase tracking-[0.24em] text-[#5f84a7]">
                Atracoes do parque
              </p>
              <h2 className="mt-4 text-[clamp(2.4rem,5vw,4.3rem)] leading-[0.95] text-[#12344f]">
                Atracoes
              </h2>
            </div>

            {featuredAttraction ? (
              <div className="grid gap-5 lg:grid-cols-[1.45fr_0.7fr]">
                <AttractionCard attraction={featuredAttraction} featured />
                <div className="grid gap-5">
                  {secondaryAttractions.length > 0 ? (
                    secondaryAttractions.map((attraction) => (
                      <AttractionCard key={attraction.title} attraction={attraction} />
                    ))
                  ) : (
                    <div className="rounded-[34px] border border-[#d8e2eb] bg-white px-6 py-10 shadow-[0_18px_40px_rgba(18,52,79,0.08)]">
                      <p className="text-[0.98rem] leading-7 text-[#567085]">
                        As atracoes publicadas no painel vao aparecer aqui.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-[34px] border border-[#d8e2eb] bg-white px-6 py-10 shadow-[0_18px_40px_rgba(18,52,79,0.08)]">
                <p className="text-[0.98rem] leading-7 text-[#567085]">
                  Nenhuma atracao publicada no painel neste momento.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="px-5 py-16 md:py-20">
          <div className="mx-auto max-w-[1240px]">
            <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="text-left">
                <p className="text-[12px] font-bold uppercase tracking-[0.24em] text-[#5f84a7]">
                  Segmentos
                </p>
                <h2 className="mt-4 text-[clamp(2.4rem,5vw,4.1rem)] leading-[0.95] text-[#12344f]">
                  Servicos
                </h2>
              </div>
              <Link href="/servicos" className="rincao-button-secondary w-fit">
                Ver segmentos
              </Link>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {[
                { title: "Escola", href: "/escola" },
                { title: "Confraternizacoes", href: "/confraternizacoes" },
                { title: "Grupos", href: "/servicos" },
                { title: "Atendimento institucional", href: "/servicos" },
              ].map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group rounded-[32px] border border-[#d8e2eb] bg-white px-6 py-8 text-left shadow-[0_18px_40px_rgba(18,52,79,0.08)] transition hover:-translate-y-1 hover:border-[#b4c9dc]"
                >
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#eef4f9] text-[1.3rem] font-bold text-[#1d6fb8]">
                    {item.title.charAt(0)}
                  </span>
                  <h3 className="mt-6 text-[1.5rem] font-bold leading-tight text-[#12344f]">
                    {item.title}
                  </h3>
                  <span className="mt-5 inline-flex items-center gap-2 text-[0.95rem] font-bold text-[#1d6fb8]">
                    Abrir pagina
                    <span aria-hidden="true">→</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section
          id="eventos"
          className="scroll-mt-[96px] bg-[#173b63] px-5 py-16 text-white md:py-20 lg:scroll-mt-[132px]"
        >
          <div className="mx-auto max-w-[1240px]">
            <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="text-left">
                <p className="text-[12px] font-bold uppercase tracking-[0.24em] text-white/62">
                  Eventos publicados
                </p>
                <h2 className="mt-4 max-w-[680px] text-[clamp(2.4rem,5vw,4.3rem)] leading-[0.95] text-white">
                  Vitrine de eventos
                </h2>
              </div>
              <Link
                href="/agenda"
                className="inline-flex w-fit items-center justify-center rounded-full border border-white/16 bg-white/10 px-7 py-4 text-[0.95rem] font-bold text-white transition hover:border-white/28 hover:bg-white/14"
              >
                Ver agenda publica
              </Link>
            </div>

            {events.length === 0 ? (
              <div className="rounded-[34px] border border-white/12 bg-white/8 px-6 py-10 text-left">
                <p className="text-[1rem] leading-7 text-white/76">
                  Nenhum evento publicado no painel neste momento.
                </p>
              </div>
            ) : (
              <div className="relative">
                {events.length > 1 ? (
                  <>
                    {eventIndex > 0 ? (
                      <button
                        type="button"
                        aria-label="Evento anterior"
                        onClick={() => moveEvent(-1)}
                        className="absolute left-0 top-1/2 z-10 hidden h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#173b63] shadow-[0_18px_40px_rgba(6,33,61,0.18)] hover:bg-[#eff5fb] md:flex"
                      >
                        <ChevronIcon direction="left" />
                      </button>
                    ) : null}
                    {eventIndex < events.length - 1 ? (
                      <button
                        type="button"
                        aria-label="Proximo evento"
                        onClick={() => moveEvent(1)}
                        className="absolute right-0 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-white text-[#173b63] shadow-[0_18px_40px_rgba(6,33,61,0.18)] hover:bg-[#eff5fb] md:flex"
                      >
                        <ChevronIcon direction="right" />
                      </button>
                    ) : null}
                  </>
                ) : null}

                <div
                  ref={eventsRef}
                  onPointerDown={handleCarouselPointerDown}
                  onPointerMove={handleCarouselPointerMove}
                  onPointerUp={handleCarouselPointerEnd}
                  onPointerCancel={handleCarouselPointerEnd}
                  onScroll={(event) =>
                    setEventIndex(resolveNearestIndex(event.currentTarget))
                  }
                  className="-mx-5 flex snap-x snap-mandatory gap-6 overflow-x-auto px-5 pb-5 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:gap-8 md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden"
                >
                  {events.map((event) => (
                    <div
                      key={event.title}
                      className="min-w-[82vw] snap-center md:min-w-0"
                    >
                      <EventCard event={event} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
