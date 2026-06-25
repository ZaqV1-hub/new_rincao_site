import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PainelAgendaEditor } from "@/components/painel-agenda-editor";
import { readEstanciaContent } from "@/lib/estancia-content-store";
import { getPainelAgendaScreenData } from "@/lib/painel-agenda";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Agenda - Editar | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelAgendaEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{
    mes?: string;
    ano?: string;
  }>;
}) {
  const session = await requirePainelAccess("vis_agenda", "/painel/agenda");
  const routeParams = await params;
  const queryParams = await searchParams;
  const data = await getPainelAgendaScreenData({
    month: queryParams.mes,
    year: queryParams.ano,
    selectedDate: routeParams.date,
  });
  const content = await readEstanciaContent();

  if (data.selectedDay?.agenda?.type === "promo") {
    const linkedEvent = content.events.find((event) =>
      event.href.includes(`date=${routeParams.date}`),
    );

    if (linkedEvent) {
      redirect(`/painel/site?editEvent=${encodeURIComponent(linkedEvent.id)}`);
    }
  }

  const returnHref = `/painel/agenda/${routeParams.date}?mes=${data.month}&ano=${data.year}`;

  return (
    <div className="grid gap-5">
      <header className="rounded-[28px] border border-[#d7e5ef] bg-white p-6 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
        <div className="flex flex-wrap items-center gap-3 text-sm text-[#5d7282]">
          <Link href="/painel" className="font-semibold text-[#246b99]">
            Home
          </Link>
          <span>/</span>
          <Link
            href={`/painel/agenda?mes=${data.month}&ano=${data.year}`}
            className="font-semibold text-[#246b99]"
          >
            Agenda
          </Link>
          <span>/</span>
          <Link href={returnHref} className="font-semibold text-[#246b99]">
            Detalhe
          </Link>
          <span>/</span>
          <span>Editar</span>
        </div>
      </header>

      <PainelAgendaEditor
        data={data}
        actor={{
          name: session.actorName,
          cpf: session.actorCpf,
        }}
        mode="edit"
        returnHref={returnHref}
        products={content.products}
      />
    </div>
  );
}
