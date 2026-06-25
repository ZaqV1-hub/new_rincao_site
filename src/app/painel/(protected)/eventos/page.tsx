import type { Metadata } from "next";
import Link from "next/link";
import { requirePainelAccess } from "@/lib/painel-session";
import { readEstanciaContent } from "@/lib/estancia-content-store";

export const metadata: Metadata = {
  title: "Painel - Eventos | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelEventosRoute() {
  await requirePainelAccess(["vis_info", "vis_agenda"], "/painel/eventos");

  const events = (await readEstanciaContent()).events.filter((event) => event.active);
  const featuredEvent = events[0] ?? null;

  return (
    <div className="space-y-3">
      <section className="panel-section p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="panel-eyebrow">Eventos</p>
            <h2 className="mt-1 text-[24px] font-black leading-tight text-[#17351f]">
              Datas promocionais
            </h2>
            <p className="mt-1 text-sm text-[#5f7564]">
              Eventos e datas promocionais do site. A criacao e a edicao das datas promocionais ficam centralizadas na area de Site.
            </p>
          </div>
          <Link
            href="/painel/site?createEvent=event"
            className="inline-flex items-center justify-center rounded-[8px] bg-[#17342d] px-3 py-2 text-xs font-semibold text-white"
          >
            Adicionar evento
          </Link>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1fr_0.9fr]">
        <article className="panel-section p-4">
          <p className="panel-eyebrow">Evento em destaque</p>
          {featuredEvent ? (
            <>
              <h3 className="mt-1 text-[20px] font-black text-[#17351f]">
                {featuredEvent.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#5f7564]">
                {featuredEvent.description}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-[8px] border border-[#dbe7d7] bg-[#f6faf3] p-3">
                  <p className="panel-eyebrow">Botao</p>
                  <p className="mt-1 text-sm font-bold text-[#17351f]">
                    {featuredEvent.buttonLabel}
                  </p>
                </div>
                <div className="rounded-[8px] border border-[#dbe7d7] bg-[#f6faf3] p-3">
                  <p className="panel-eyebrow">Link</p>
                  <p className="mt-1 break-all text-sm font-bold text-[#17351f]">
                    {featuredEvent.href}
                  </p>
                </div>
                <div className="rounded-[8px] border border-[#dbe7d7] bg-[#f6faf3] p-3">
                  <p className="panel-eyebrow">Status</p>
                  <p className="mt-1 text-sm font-bold text-[#17351f]">Publicado</p>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-3 rounded-[12px] border border-dashed border-[#d7e3d2] bg-[#f7fbf5] px-4 py-4 text-sm leading-6 text-[#5f7564]">
              Nenhum evento atual cadastrado. Quando voce remover todos os eventos, esta area
              fica vazia mesmo.
            </div>
          )}
        </article>

        <article className="panel-section p-4">
          <p className="panel-eyebrow">Eventos ativos</p>
          <h3 className="mt-1 text-[20px] font-black text-[#17351f]">
            {events.length === 0 ? "Nenhum evento ativo" : `${events.length} evento(s) ativo(s)`}
          </h3>
          <div className="mt-3 grid gap-2">
            {events.length > 0 ? (
              events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-[10px] border border-[#dbe7d7] bg-white px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-black text-[#17351f]">{event.title}</p>
                      <p className="mt-1 text-sm leading-5 text-[#5f7564]">
                        {event.description}
                      </p>
                    </div>
                    <span className="rounded-[8px] bg-[#eef7ea] px-2.5 py-1 text-[11px] font-semibold text-[#2b6a36]">
                      Ativo
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[8px] border border-[#dbe7d7] bg-white px-3 py-3 text-sm text-[#5f7564]">
                Nao ha eventos atuais cadastrados.
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
