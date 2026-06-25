"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { homeSlides } from "@/lib/site-content";

export function HomeHeroSlider() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % homeSlides.length);
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  const currentSlide = homeSlides[activeIndex];
  const isExternal = /^https?:\/\//.test(currentSlide.href);

  return (
    <section className="relative mb-[35px] w-full overflow-hidden bg-black">
      <div className="relative aspect-[1400/500] min-h-[220px] w-full md:min-h-[500px]">
        {isExternal ? (
          <a href={currentSlide.href} className="absolute inset-0 z-10">
            <span className="sr-only">Abrir destaque</span>
          </a>
        ) : (
          <Link href={currentSlide.href} className="absolute inset-0 z-10">
            <span className="sr-only">Abrir destaque</span>
          </Link>
        )}
        {homeSlides.map((slide, index) => (
          <Image
            key={slide.src}
            src={slide.src}
            alt={slide.alt}
            fill
            priority={index === 0}
            className={`object-cover transition-opacity duration-700 ${
              index === activeIndex ? "opacity-100" : "opacity-0"
            }`}
            sizes="100vw"
          />
        ))}
      </div>

      <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex items-center pl-3 md:pl-6">
        <button
          type="button"
          aria-label="Slide anterior"
          className="site-slider-arrow site-slider-arrow-left pointer-events-auto"
          onClick={() =>
            setActiveIndex(
              activeIndex === 0 ? homeSlides.length - 1 : activeIndex - 1,
            )
          }
        />
      </div>

      <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex items-center pr-3 md:pl-6 md:pr-6">
        <button
          type="button"
          aria-label="Próximo slide"
          className="site-slider-arrow site-slider-arrow-right pointer-events-auto"
          onClick={() => setActiveIndex((activeIndex + 1) % homeSlides.length)}
        />
      </div>

      <div
        aria-hidden
        className="absolute bottom-[-13px] left-0 z-20 h-[66px] w-full bg-cover bg-left-top bg-no-repeat"
        style={{ backgroundImage: "url('/theme/color-bar-2.png')" }}
      />
    </section>
  );
}
