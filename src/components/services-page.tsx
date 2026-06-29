import Image from "next/image";
import Link from "next/link";
import { segmentCards } from "@/lib/site-content";

export function ServicesPage() {
  return (
    <div className="bg-[#f6f8fb] text-[#12344f]">
      <section className="bg-[#173b63] px-5 pb-16 pt-[118px] text-white md:pb-20">
        <div className="mx-auto max-w-[1240px] text-left">
          <p className="text-[12px] font-bold uppercase tracking-[0.24em] text-white/62">
            Segmentos de atendimento
          </p>
          <h1 className="mt-4 text-[clamp(2.5rem,5vw,4.8rem)] leading-[0.95] text-white">
            Servicos
          </h1>
        </div>
      </section>

      <section className="px-5 py-16 md:py-20">
        <div className="mx-auto max-w-[1240px]">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {segmentCards.map((segment) => (
              <article
                key={segment.href}
                className="rounded-[32px] border border-[#d8e2eb] bg-white p-7 text-left shadow-[0_18px_40px_rgba(18,52,79,0.08)]"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#eef4f9]">
                  <Image
                    src={segment.iconSrc}
                    alt={segment.title}
                    width={34}
                    height={34}
                    className="h-8 w-8 object-contain"
                  />
                </div>
                <h2 className="mt-6 text-[1.7rem] font-bold leading-tight text-[#12344f]">
                  {segment.title}
                </h2>
                <p className="mt-4 text-[0.98rem] leading-7 text-[#567085]">
                  {segment.text}
                </p>
                <Link href={segment.href} className="rincao-button mt-6 inline-flex">
                  Abrir pagina
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
