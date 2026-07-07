"use client";

import Link from "next/link";
import { hasLegacyPanelResource } from "@/lib/painel-access";
import { painelAdminModules } from "@/lib/painel-admin-modules";

type PainelAdminSidebarProps = {
  currentHref?: string;
  legacyResources: readonly string[];
};

export function PainelAdminSidebar({
  currentHref,
  legacyResources,
}: PainelAdminSidebarProps) {
  const visibleModules = painelAdminModules.filter((module) =>
    hasLegacyPanelResource(legacyResources, module.resources),
  );

  return (
    <aside className="grid gap-5 self-start">
      <section className="rounded-[6px] border border-[#d7e1e8] bg-white shadow-[0_10px_28px_rgba(26,61,94,0.08)]">
        <div className="border-b border-[#d7e1e8] bg-[#f4f8fc] px-6 py-4 text-[20px] text-[#205a7f]">
          Administrativo
        </div>
        <div className="grid gap-2 px-4 py-4">
          {visibleModules.map((module) => {
            const active = currentHref === module.href;
            return (
              <Link
                key={module.href}
                href={module.href}
                className={`rounded-[4px] border px-4 py-3 text-sm transition ${
                  active
                    ? "border-[#5f84a3] bg-[#5f84a3] text-white"
                    : "border-[#d7e1e8] bg-white text-[#205a7f] hover:bg-[#f4f8fc]"
                }`}
              >
                {module.label}
              </Link>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
