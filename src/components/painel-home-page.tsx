import Link from "next/link";
import {
  hasLegacyPanelResource,
  type LegacyPanelResource,
  type LegacyPanelRoleId,
} from "@/lib/painel-access";
import type { PainelHomePageData } from "@/lib/painel-home";

type PainelHomePageProps = {
  data: PainelHomePageData;
  legacyResources: readonly string[];
  legacyRoleId: LegacyPanelRoleId | null;
};

type QuickLink = {
  href: string;
  label: string;
  resources: LegacyPanelResource[];
  roles: LegacyPanelRoleId[];
};

const quickLinks: QuickLink[] = [
  {
    href: "/painel/bilheteria",
    label: "Bilheteria",
    resources: ["vis_bilhet"],
    roles: [1, 2, 3],
  },
  {
    href: "/painel/agenda",
    label: "Agenda",
    resources: ["vis_agenda"],
    roles: [1, 2],
  },
  {
    href: "/painel/compras",
    label: "Compras",
    resources: ["vis_compra"],
    roles: [1, 2],
  },
  {
    href: "/painel/administrativo",
    label: "Administrativo",
    resources: ["vis_usu", "vis_situsu"],
    roles: [1],
  },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function PainelHomePage({
  data,
  legacyResources,
  legacyRoleId,
}: PainelHomePageProps) {
  const visibleQuickLinks = quickLinks.filter((item) => {
    if (!legacyRoleId || !item.roles.includes(legacyRoleId)) {
      return false;
    }

    return hasLegacyPanelResource(legacyResources, item.resources);
  });

  return (
    <div className="space-y-6 text-[#35503b]">
      <section className="panel-section px-5 py-5">
        <p className="panel-eyebrow">Visao geral</p>
        <div className="mt-3 grid gap-5 xl:grid-cols-[1fr_0.85fr]">
          <div>
            <h2 className="text-[30px] font-black leading-tight text-[#17351f]">
              Valor arrecadado no dia
            </h2>
            <p className="mt-3 max-w-[620px] text-[15px] leading-7 text-[#5f7564]">
              Soma das vendas confirmadas do site e da bilheteria.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[8px] border border-[#dbe7d7] bg-[#f6faf3] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6e9464]">
                Total
              </p>
              <p className="mt-2 text-[26px] font-black text-[#17351f]">
                {formatCurrency(data.revenue.total)}
              </p>
            </div>
            <div className="rounded-[8px] border border-[#dbe7d7] bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6e9464]">
                Site
              </p>
              <p className="mt-2 text-[22px] font-black text-[#17351f]">
                {formatCurrency(data.revenue.site)}
              </p>
            </div>
            <div className="rounded-[8px] border border-[#dbe7d7] bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6e9464]">
                Bilheteria
              </p>
              <p className="mt-2 text-[22px] font-black text-[#17351f]">
                {formatCurrency(data.revenue.boxOffice)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel-section p-5">
        <p className="panel-eyebrow">Acesso rapido</p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {visibleQuickLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[8px] border border-[#dbe7d7] bg-white px-4 py-4 text-center text-[15px] font-black text-[#17351f] shadow-[0_12px_26px_rgba(19,48,41,0.06)] transition hover:-translate-y-0.5 hover:border-[#7fcf72]"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      {hasLegacyPanelResource(legacyResources, ["vis_info", "vis_param"]) ? (
        <section className="grid gap-5 xl:grid-cols-2">
          <article className="panel-section p-5">
            <p className="panel-eyebrow">Eventos</p>
            <h3 className="mt-2 text-[24px] font-black text-[#17351f]">
              Eventos
            </h3>
            <p className="mt-3 text-[15px] leading-7 text-[#5f7564]">
              Publique eventos na home e leve o visitante direto para a data de compra.
            </p>
            <Link
              href="/painel/site#eventos"
              className="mt-5 inline-flex min-h-11 items-center rounded-[8px] bg-[#17342d] px-5 text-sm font-black text-white"
            >
              Configurar eventos
            </Link>
          </article>

          <article className="panel-section p-5">
            <p className="panel-eyebrow">Site</p>
            <h3 className="mt-2 text-[24px] font-black text-[#17351f]">
              Imagens e atracoes
            </h3>
            <p className="mt-3 text-[15px] leading-7 text-[#5f7564]">
              Organize imagens da home, versoes mobile e desktop, atracoes e chamadas
              do site.
            </p>
            <Link
              href="/painel/site"
              className="mt-5 inline-flex min-h-11 items-center rounded-[8px] bg-[#17342d] px-5 text-sm font-black text-white"
            >
              Configurar site
            </Link>
          </article>
        </section>
      ) : null}
    </div>
  );
}
