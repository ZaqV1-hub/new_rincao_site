import Image from "next/image";
import Link from "next/link";
import { infoPages } from "@/lib/site-content";

const muralImages = infoPages["melhor-idade"].extraGallerySections?.[0]?.items ?? [];

export function LegacyMuralPage({ requestedSlug }: { requestedSlug?: string | null }) {
  return (
    <section className="w-full">
      <div
        className="relative top-[-10px] mb-[15px] h-[265px] w-full bg-cover bg-center bg-no-repeat max-md:top-0 max-md:mb-3 max-md:h-[220px]"
        style={{ backgroundImage: "url('/photos/melhor-idade.jpg')" }}
      >
        <div
          className="absolute left-0 top-[160px] h-[130px] w-full bg-left-top bg-no-repeat pt-[36px] pl-5 text-left max-md:top-[108px] max-md:h-[112px] max-md:bg-[length:auto_112px] max-md:pt-[30px] max-md:pl-[18px]"
          style={{ backgroundImage: "url('/theme/color-bar-3.png')" }}
        >
          <h1 className="legacy-condensed text-[30px] leading-none text-white drop-shadow-[2px_2px_5px_rgba(0,0,0,0.4)]">
            Mural Legado
          </h1>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1400px] px-4 pb-10 md:px-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="text-left">
            <p className="text-[15px] leading-7 text-[#333]">
              {requestedSlug
                ? `A URL /mural/${requestedSlug} foi preservada, mas o conteudo historico desse album foi consolidado no novo institucional.`
                : "As URLs antigas de mural agora apontam para um arquivo consolidado dentro do novo institucional."}
            </p>
            <p className="mt-4 text-[15px] leading-7 text-[#333]">
              No site atual em producao, o bloco de mural ja nao lista albuns ativos na pagina de
              {" "}
              <Link href="/melhor-idade-grupos-mistos" className="underline">
                Melhor Idade &amp; Grupos Mistos
              </Link>
              . Para o cutover, centralizamos essa memoria visual sem deixar as rotas antigas quebrarem.
            </p>

            <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {muralImages.map((image) => (
                <div
                  key={image.src}
                  className="relative min-h-[180px] overflow-hidden rounded bg-[#eaeaea]"
                >
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    className="object-cover transition-transform duration-300 hover:scale-110"
                    sizes="(max-width: 768px) 100vw, 25vw"
                  />
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-[24px] bg-[#efefef] p-5 text-left">
            <h2 className="legacy-rounded text-[25px] font-normal text-[#194c6d]">
              Destino oficial
            </h2>
            <p className="mt-4 text-[14px] leading-6 text-[#333]">
              O mural foi incorporado como secao da experiencia institucional de Melhor Idade.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/melhor-idade-grupos-mistos#mural-de-fotos"
                className="legacy-button green text-center"
              >
                Abrir mural no institucional
              </Link>
              <Link href="/servicos" className="legacy-button text-center">
                Ver servicos
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
