import type { Metadata } from "next";
import Link from "next/link";
import { painelAdminModules } from "@/lib/painel-admin-modules";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Administrativo | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PainelAdministrativoPage() {
  const session = await requirePainelAccess(
    ["vis_usu", "vis_situsu"],
    "/painel/administrativo",
  );

  const visibleModules = painelAdminModules.filter((module) =>
    module.resources.some((resource) => session.legacyResources.includes(resource)),
  );

  return (
    <div className="space-y-5">
      <section className="panel-section p-5">
        <p className="panel-eyebrow">Administrativo</p>
        <h1 className="mt-2 text-[30px] font-black leading-tight text-[#17351f]">
          Usuários e permissões
        </h1>
        <p className="mt-3 max-w-[720px] text-[15px] leading-7 text-[#5f7564]">
          Gerencie acessos internos do painel e contas dos clientes do site.
        </p>
      </section>

      <section className="panel-section p-5">
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleModules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="rounded-[8px] border border-[#dbe7d7] bg-white px-5 py-5 shadow-[0_12px_26px_rgba(19,48,41,0.06)] transition hover:-translate-y-0.5 hover:border-[#7fcf72]"
            >
              <div className="text-[22px] font-black text-[#17351f]">
                {module.label}
              </div>
              <p className="mt-2 text-sm leading-6 text-[#5f7564]">
                {module.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
