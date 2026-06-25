import Image from "next/image";
import Link from "next/link";
import type { InfoPage } from "@/lib/site-content";

function GalleryImage({ src, alt }: { src: string; alt: string }) {
  if (src.startsWith("http")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className="h-full w-full object-cover transition-transform duration-300 hover:scale-110" />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className="object-cover transition-transform duration-300 hover:scale-110"
      sizes="(max-width: 768px) 100vw, 25vw"
    />
  );
}

export function InfoPageView({ page }: { page: InfoPage }) {
  return (
    <section className="w-full">
      <div
        className="relative top-[-10px] mb-[15px] h-[265px] w-full bg-cover bg-center bg-no-repeat max-md:top-0 max-md:mb-3 max-md:h-[220px]"
        style={{
          backgroundImage: page.heroImage
            ? `url('${page.heroImage.src}')`
            : "url('/photos/estrutura-galeria.jpg')",
        }}
      >
        <div
          className="absolute left-0 top-[160px] h-[130px] w-full bg-left-top bg-no-repeat pt-[36px] pl-5 text-left max-md:top-[108px] max-md:h-[112px] max-md:bg-[length:auto_112px] max-md:pt-[30px] max-md:pl-[18px]"
          style={{ backgroundImage: "url('/theme/color-bar-3.png')" }}
        >
          <h1 className="legacy-condensed text-[30px] leading-none text-white drop-shadow-[2px_2px_5px_rgba(0,0,0,0.4)]">
            {page.title}
          </h1>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1400px] px-4 pb-10 md:px-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="text-left">
            <p className="text-[15px] leading-7 text-[#333]">{page.summary}</p>

            {page.sections.map((section) => (
              <article key={section.title} className="mt-8">
                <h2 className="legacy-rounded text-[28px] font-normal text-[#1f6490]">
                  {section.title}
                </h2>
                {section.intro ? (
                  <p className="mt-3 text-[14px] leading-7 text-[#333]">
                    {section.intro}
                  </p>
                ) : null}
                {section.paragraphs?.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="mt-3 text-[14px] leading-7 text-[#333]"
                  >
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
                  <p className="mt-3 text-[13px] leading-6 text-[#155188]">
                    {section.note}
                  </p>
                ) : null}
              </article>
            ))}
          </div>

          <aside className="text-left">
            {page.heroImage ? (
              <div className="relative mb-4 min-h-[260px] overflow-hidden bg-[#eaeaea]">
                <Image
                  src={page.heroImage.src}
                  alt={page.heroImage.alt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 360px"
                />
              </div>
            ) : null}

            <div className="bg-[#efefef] p-5">
              <h2 className="legacy-rounded text-[25px] font-normal text-[#194c6d]">
                Informacoes Rapidas
              </h2>
              {page.facts?.length ? (
                <ul className="mt-4 space-y-3">
                  {page.facts.map((fact) => (
                    <li key={fact.label}>
                      <strong className="legacy-condensed block text-[22px] text-[#3393d6]">
                        {fact.label}
                      </strong>
                      <span className="text-[13px] leading-6 text-[#333]">
                        {fact.value}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-6 flex flex-col gap-3">
                <Link href={page.cta.href} className="legacy-button green text-center">
                  {page.cta.label}
                </Link>
                {page.secondaryCta ? (
                  <Link href={page.secondaryCta.href} className="legacy-button text-center">
                    {page.secondaryCta.label}
                  </Link>
                ) : null}
              </div>
            </div>
          </aside>
        </div>

        {page.videos?.length ? (
          <div className="mt-10 border-t border-[#eaeaea] pt-8">
            <h2 className="legacy-rounded text-left text-[25px] font-normal text-[#194c6d]">
              Conteudo em video
            </h2>
            <div className="mt-6 grid gap-6 xl:grid-cols-3">
              {page.videos.map((video) => (
                <article key={video.src} className="text-left">
                  <h3 className="legacy-condensed text-[24px] text-[#7b5f3b]">
                    {video.title}
                  </h3>
                  <div className="relative mt-3 overflow-hidden rounded bg-[#eaeaea] pb-[56.25%]">
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
          </div>
        ) : null}

        {page.extraGallerySections?.map((section) => (
          <div
            key={section.title}
            id={section.anchorId}
            className="mt-10 border-t border-[#eaeaea] pt-8"
          >
            <h2 className="legacy-rounded text-left text-[25px] font-normal text-[#194c6d]">
              {section.title}
            </h2>
            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {section.items.map((item) => (
                <div
                  key={`${section.title}-${item.src}`}
                  className="relative min-h-[180px] overflow-hidden rounded bg-[#eaeaea]"
                >
                  <GalleryImage src={item.src} alt={item.alt} />
                </div>
              ))}
            </div>
            {section.note ? (
              <p className="mt-4 text-left text-[13px] leading-6 text-[#155188]">
                {section.note}
              </p>
            ) : null}
          </div>
        ))}

        {page.gallery?.length ? (
          <div className="mt-10 border-t border-[#eaeaea] pt-8">
            <h2 className="legacy-rounded text-left text-[25px] font-normal text-[#194c6d]">
              Galeria de Fotos
            </h2>
            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {page.gallery.map((item) => (
                <div
                  key={item.src}
                  className="relative min-h-[180px] overflow-hidden rounded bg-[#eaeaea]"
                >
                  <GalleryImage src={item.src} alt={item.alt} />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
