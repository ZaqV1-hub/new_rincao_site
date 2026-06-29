import Image from "next/image";
import Link from "next/link";
import type { InfoPage } from "@/lib/site-content";

function isExternalHref(href: string) {
  return href.startsWith("http://") || href.startsWith("https://");
}

function ActionLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className: string;
}) {
  if (isExternalHref(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function MediaImage({
  src,
  alt,
  fill = false,
  className,
}: {
  src: string;
  alt: string;
  fill?: boolean;
  className?: string;
}) {
  if (src.startsWith("http")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className} />;
  }

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        className={className}
        sizes="(max-width: 1024px) 100vw, 33vw"
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={1280}
      height={720}
      className={className}
    />
  );
}

export function InfoPageView({ page }: { page: InfoPage }) {
  return (
    <div className="bg-[#f6f8fb] text-[#12344f]">
      <section className="relative isolate overflow-hidden bg-[#12344f] px-5 pb-18 pt-[118px] text-white md:pb-24">
        <div className="absolute inset-0">
          {page.heroImage ? (
            <MediaImage
              src={page.heroImage.src}
              alt={page.heroImage.alt}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_top,#3b6ea3_0%,#173b63_50%,#0d2234_100%)]" />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(8,18,28,0.84)_10%,rgba(8,18,28,0.52)_48%,rgba(8,18,28,0.7)_100%)]" />
        </div>

        <div className="relative mx-auto max-w-[1240px]">
          <div className="max-w-[760px] text-left">
            <p className="text-[12px] font-bold uppercase tracking-[0.24em] text-white/64">
              {page.eyebrow}
            </p>
            <h1 className="mt-4 font-[var(--font-salsa)] text-[clamp(2.5rem,6vw,5rem)] leading-[0.95] text-white">
              {page.title}
            </h1>
            <p className="mt-6 max-w-[640px] text-[1rem] leading-8 text-white/78 md:text-[1.08rem]">
              {page.summary}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ActionLink href={page.cta.href} className="rincao-button min-w-[210px]">
                {page.cta.label}
              </ActionLink>
              {page.secondaryCta ? (
                <ActionLink
                  href={page.secondaryCta.href}
                  className="rincao-button-secondary min-w-[210px] border-white/16 bg-white/10 text-white hover:border-white/26 hover:bg-white/14"
                >
                  {page.secondaryCta.label}
                </ActionLink>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 md:py-20">
        <div className="mx-auto max-w-[1240px]">
          {page.highlights.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-3">
              {page.highlights.map((highlight) => (
                <article
                  key={highlight}
                  className="rounded-[24px] border border-[#d8e2eb] bg-white px-6 py-6 text-left shadow-[0_18px_40px_rgba(18,52,79,0.08)]"
                >
                  <p className="text-[0.98rem] leading-7 text-[#234862]">{highlight}</p>
                </article>
              ))}
            </div>
          ) : null}

          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6 text-left">
              {page.sections.map((section) => (
                <article
                  key={section.title}
                  className="rounded-[28px] border border-[#d8e2eb] bg-white p-7 shadow-[0_18px_40px_rgba(18,52,79,0.08)]"
                >
                  <h2 className="font-[var(--font-salsa)] text-[2rem] leading-[1] text-[#12344f]">
                    {section.title}
                  </h2>
                  {section.intro ? (
                    <p className="mt-4 text-[1rem] leading-8 text-[#2d556f]">
                      {section.intro}
                    </p>
                  ) : null}
                  {section.paragraphs?.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="mt-4 text-[0.98rem] leading-8 text-[#5c7488]"
                    >
                      {paragraph}
                    </p>
                  ))}
                  {section.items?.length ? (
                    <ul className="mt-5 space-y-3">
                      {section.items.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-3 text-[0.98rem] leading-7 text-[#36586f]"
                        >
                          <span className="mt-2 h-2.5 w-2.5 flex-none rounded-full bg-[#1d6fb8]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {section.note ? (
                    <p className="mt-5 rounded-[18px] bg-[#eef4f9] px-4 py-4 text-[0.92rem] leading-7 text-[#1d587e]">
                      {section.note}
                    </p>
                  ) : null}
                </article>
              ))}

              {page.videos?.length ? (
                <section className="rounded-[28px] border border-[#d8e2eb] bg-white p-7 shadow-[0_18px_40px_rgba(18,52,79,0.08)]">
                  <h2 className="text-left font-[var(--font-salsa)] text-[2rem] leading-[1] text-[#12344f]">
                    Conteudo em video
                  </h2>
                  <div className="mt-6 grid gap-5 xl:grid-cols-2">
                    {page.videos.map((video) => (
                      <article key={video.src} className="text-left">
                        <h3 className="text-[1.15rem] font-bold text-[#12344f]">
                          {video.title}
                        </h3>
                        <div className="relative mt-3 overflow-hidden rounded-[22px] bg-[#e8eef4] pb-[56.25%]">
                          <iframe
                            title={video.title}
                            src={video.src}
                            className="absolute inset-0 h-full w-full"
                            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {page.extraGallerySections?.map((section) => (
                <section
                  key={section.title}
                  id={section.anchorId}
                  className="rounded-[28px] border border-[#d8e2eb] bg-white p-7 shadow-[0_18px_40px_rgba(18,52,79,0.08)]"
                >
                  <h2 className="text-left font-[var(--font-salsa)] text-[2rem] leading-[1] text-[#12344f]">
                    {section.title}
                  </h2>
                  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {section.items.map((item) => (
                      <div
                        key={`${section.title}-${item.src}`}
                        className="relative min-h-[210px] overflow-hidden rounded-[22px] bg-[#e8eef4]"
                      >
                        <MediaImage
                          src={item.src}
                          alt={item.alt}
                          fill
                          className="object-cover transition duration-300 hover:scale-[1.03]"
                        />
                      </div>
                    ))}
                  </div>
                  {section.note ? (
                    <p className="mt-5 text-left text-[0.92rem] leading-7 text-[#1d587e]">
                      {section.note}
                    </p>
                  ) : null}
                </section>
              ))}

              {page.gallery?.length ? (
                <section className="rounded-[28px] border border-[#d8e2eb] bg-white p-7 shadow-[0_18px_40px_rgba(18,52,79,0.08)]">
                  <h2 className="text-left font-[var(--font-salsa)] text-[2rem] leading-[1] text-[#12344f]">
                    Galeria
                  </h2>
                  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {page.gallery.map((item) => (
                      <div
                        key={item.src}
                        className="relative min-h-[210px] overflow-hidden rounded-[22px] bg-[#e8eef4]"
                      >
                        <MediaImage
                          src={item.src}
                          alt={item.alt}
                          fill
                          className="object-cover transition duration-300 hover:scale-[1.03]"
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="space-y-5">
              {page.heroImage ? (
                <div className="overflow-hidden rounded-[28px] border border-[#d8e2eb] bg-white shadow-[0_18px_40px_rgba(18,52,79,0.08)]">
                  <div className="relative h-[280px] bg-[#e8eef4]">
                    <MediaImage
                      src={page.heroImage.src}
                      alt={page.heroImage.alt}
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              ) : null}

              <div className="rounded-[28px] border border-[#d8e2eb] bg-white p-6 text-left shadow-[0_18px_40px_rgba(18,52,79,0.08)] lg:sticky lg:top-[118px]">
                <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[#5f84a7]">
                  Informacoes rapidas
                </p>

                {page.facts?.length ? (
                  <div className="mt-5 space-y-4">
                    {page.facts.map((fact) => (
                      <div
                        key={fact.label}
                        className="rounded-[18px] bg-[#eef4f9] px-4 py-4"
                      >
                        <strong className="block text-[0.92rem] uppercase tracking-[0.16em] text-[#5f84a7]">
                          {fact.label}
                        </strong>
                        <span className="mt-2 block text-[1rem] leading-7 text-[#12344f]">
                          {fact.value}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="mt-6 flex flex-col gap-3">
                  <ActionLink href={page.cta.href} className="rincao-button justify-center">
                    {page.cta.label}
                  </ActionLink>
                  {page.secondaryCta ? (
                    <ActionLink
                      href={page.secondaryCta.href}
                      className="rincao-button-secondary justify-center"
                    >
                      {page.secondaryCta.label}
                    </ActionLink>
                  ) : null}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
