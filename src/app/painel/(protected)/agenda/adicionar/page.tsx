import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PainelAgendaEditor } from "@/components/painel-agenda-editor";
import { readEstanciaContent } from "@/lib/estancia-content-store";
import { getPainelAgendaScreenData } from "@/lib/painel-agenda";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Agenda - Adicionar | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelAgendaAddPage({
  searchParams,
}: {
  searchParams: Promise<{
    mes?: string;
    ano?: string;
    dia?: string;
    tipo?: string;
  }>;
}) {
  const session = await requirePainelAccess("vis_agenda", "/painel/agenda/adicionar");
  const params = await searchParams;

  if (params.tipo === "promo") {
    redirect("/painel/site?createEvent=date");
  }

  const data = await getPainelAgendaScreenData({
    month: params.mes,
    year: params.ano,
    selectedDate: params.dia,
  });
  const content = await readEstanciaContent();
  const returnHref = `/painel/agenda?mes=${data.month}&ano=${data.year}`;

  return (
    <div className="grid gap-5">
      <header className="rounded-[28px] border border-[#d7e5ef] bg-white p-6 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
        <div className="flex flex-wrap items-center gap-3 text-sm text-[#5d7282]">
          <Link href="/painel" className="font-semibold text-[#246b99]">
            Home
          </Link>
          <span>/</span>
          <Link href={returnHref} className="font-semibold text-[#246b99]">
            Agenda
          </Link>
          <span>/</span>
          <span>Adicionar</span>
        </div>
        <p className="mt-3 text-sm text-[#5d7282]">
          Use esta tela apenas para datas padrao da agenda. Datas promocionais e eventos ficam na area de Site.
        </p>
      </header>

      <PainelAgendaEditor
        data={data}
        actor={{
          name: session.actorName,
          cpf: session.actorCpf,
        }}
        mode="create"
        returnHref={returnHref}
        initialType="padra"
        products={content.products}
      />
    </div>
  );
}
