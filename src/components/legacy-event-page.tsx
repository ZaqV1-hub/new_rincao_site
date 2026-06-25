import Image from "next/image";
import Link from "next/link";
import type { LegacyEvent } from "@/lib/legacy-events-content";

type LegacyEventPageProps = {
  event: LegacyEvent | null;
  requestedSlug?: string | null;
  knownEvents: LegacyEvent[];
};

export function LegacyEventPage({
  event,
  requestedSlug,
  knownEvents,
}: LegacyEventPageProps) {
  if (!event) {
    return (
      <section className="w-full">
        <div
          className="relative top-[-10px] mb-[15px] h-[265px] w-full bg-cover bg-center bg-no-repeat max-md:top-0 max-md:mb-3 max-md:h-[220px]"
          style={{ backgroundImage: "url('/hero/current/banner-onda.jpg')" }}
        >
          <div
            className="absolute left-0 top-[160px] h-[130px] w-full bg-left-top bg-no-repeat pt-[36px] pl-5 text-left max-md:top-[108px] max-md:h-[112px] max-md:bg-[length:auto_112px] max-md:pt-[30px] max-md:pl-[18px]"
            style={{ backgroundImage: "url('/theme/color-bar-3.png')" }}
          >
            <h1 className="legacy-condensed text-[30px] leading-none text-white drop-shadow-[2px_2px_5px_rgba(0,0,0,0.4)]">
              Eventos Legados
            </h1>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1400px] px-4 pb-10 md:px-6">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            <div className="text-left">
              <p className="text-[15px] leading-7 text-[#333]">
                {requestedSlug
                  ? `A URL /evento/${requestedSlug} foi preservada no novo institucional, mas nao ha mais uma pagina individual ativa para esse slug.`
                  : "As URLs legadas de evento agora ficam concentradas neste arquivo do novo institucional."}
              </p>
              <p className="mt-4 text-[15px] leading-7 text-[#333]">
                Para os eventos ainda divulgados na home do site, mantivemos paginas estaticas equivalentes. Para outros slugs antigos, o destino oficial agora e a
                {" "}
                <Link href="/agenda" className="underline">
                  agenda publica
                </Link>
                , que abre a compra e o agendamento no frontend novo.
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {knownEvents.map((item) => (
                  <Link
                    key={item.slug}
                    href={item.path}
                    className="rounded-[24px] bg-[#f5f2ed] p-5 text-left transition hover:bg-[#ede6de]"
                  >
                    <strong className="legacy-rounded block text-[24px] text-[#194c6d]">
                      {item.title}
                    </strong>
                    <span className="mt-3 block text-[14px] leading-6 text-[#333]">
                      {item.summary}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <aside className="rounded-[24px] bg-[#efefef] p-5 text-left">
              <h2 className="legacy-rounded text-[25px] font-normal text-[#194c6d]">
                Proximos passos
              </h2>
              <div className="mt-6 flex flex-col gap-3">
                <Link href="/agenda" className="legacy-button green text-center">
                  Ver agenda atual
                </Link>
                <Link href="/agenda" className="legacy-button text-center">
                  Ir para agenda
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full">
      <div
        className="relative top-[-10px] mb-[15px] h-[265px] w-full bg-cover bg-center bg-no-repeat max-md:top-0 max-md:mb-3 max-md:h-[220px]"
        style={{ backgroundImage: `url('${event.heroImage}')` }}
      >
        <div
          className="absolute left-0 top-[160px] h-[130px] w-full bg-left-top bg-no-repeat pt-[36px] pl-5 text-left max-md:top-[108px] max-md:h-[112px] max-md:bg-[length:auto_112px] max-md:pt-[30px] max-md:pl-[18px]"
          style={{ backgroundImage: "url('/theme/color-bar-3.png')" }}
        >
          <h1 className="legacy-condensed text-[30px] leading-none text-white drop-shadow-[2px_2px_5px_rgba(0,0,0,0.4)]">
            {event.title}
          </h1>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1400px] px-4 pb-10 md:px-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="text-left">
            <p className="text-[15px] leading-7 text-[#333]">{event.summary}</p>

            {event.sections.map((section) => (
              <article key={section.title} className="mt-8">
                <h2 className="legacy-rounded text-[28px] font-normal text-[#1f6490]">
                  {section.title}
                </h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="mt-3 text-[14px] leading-7 text-[#333]">
                    {paragraph}
                  </p>
                ))}
                {section.items?.length ? (
                  <ul className="mt-4 space-y-2">
                    {section.items.map((item) => (
                      <li
                        key={item}
                        className="bg-[url('/theme/bullet.png')] bg-[position:left_5px] bg-no-repeat pl-5 text-[14px] leading-6 text-[#5d462c]"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {section.note ? (
                  <p className="mt-3 text-[13px] leading-6 text-[#155188]">{section.note}</p>
                ) : null}
              </article>
            ))}
          </div>

          <aside className="text-left">
            <div className="relative mb-4 min-h-[260px] overflow-hidden bg-[#eaeaea]">
              <Image
                src={event.heroImage}
                alt={event.heroAlt}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 360px"
              />
            </div>

            <div className="bg-[#efefef] p-5">
              <h2 className="legacy-rounded text-[25px] font-normal text-[#194c6d]">
                Destaques
              </h2>
              <ul className="mt-4 space-y-3">
                {event.highlights.map((highlight) => (
                  <li key={highlight} className="text-[13px] leading-6 text-[#333]">
                    {highlight}
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex flex-col gap-3">
                {event.primaryCta ? (
                  <Link href={event.primaryCta.href} className="legacy-button green text-center">
                    {event.primaryCta.label}
                  </Link>
                ) : null}
                {event.secondaryCta ? (
                  <a
                    href={event.secondaryCta.href}
                    target="_blank"
                    rel="noreferrer"
                    className="legacy-button text-center"
                  >
                    {event.secondaryCta.label}
                  </a>
                ) : null}
                <Link href="/agenda" className="legacy-button text-center">
                  Ver agenda atual
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
