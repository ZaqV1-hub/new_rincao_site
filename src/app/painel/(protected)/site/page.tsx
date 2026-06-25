import type { Metadata } from "next";
import { PainelSiteManager } from "@/components/painel-site-manager";
import { readRincaoContent } from "@/lib/rincao-content-store";
import {
  listPainelAgendaInformationOptions,
  listPainelAgendaPriceTables,
} from "@/lib/painel-agenda";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Site | Rincao",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelSiteRoute({
  searchParams,
}: {
  searchParams: Promise<{
    editEvent?: string;
    createEvent?: string;
  }>;
}) {
  await requirePainelAccess(["vis_info", "vis_param"], "/painel/site");
  const params = await searchParams;
  const [content, priceTables, informationOptions] = await Promise.all([
    readRincaoContent(),
    listPainelAgendaPriceTables(),
    listPainelAgendaInformationOptions(),
  ]);

  return (
    <div className="space-y-5">
      <section className="panel-section p-5">
        <p className="panel-eyebrow">Site</p>
        <h2 className="mt-2 text-[28px] font-black leading-tight text-[#17351f]">
          Conteudo do site
        </h2>
        <p className="mt-3 max-w-[760px] text-[15px] leading-7 text-[#5f7564]">
          Gerencie banners, atracoes, destaques e eventos exibidos no site do
          Rincao.
        </p>
      </section>

      <PainelSiteManager
        content={content}
        initialEditEventId={params.editEvent ?? null}
        initialOpenCreateEvent={Boolean(params.createEvent)}
        defaultPriceTableId={priceTables[0]?.id ?? null}
        defaultInformationId={informationOptions[0]?.id ?? null}
      />
    </div>
  );
}
