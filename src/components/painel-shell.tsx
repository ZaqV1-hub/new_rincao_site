"use client";

import { EstanciaLogo } from "@/components/estancia-logo";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  hasLegacyPanelResource,
  type LegacyPanelResource,
  type LegacyPanelRoleId,
  type LegacyPanelRoleName,
} from "@/lib/painel-access";
import { isPainelShellNavItemActive } from "@/lib/painel-shell-nav";
import type {
  OperationsPermission,
  OperationsRole,
} from "@/lib/ops-permissions";

type PainelShellProps = {
  actorName: string | null;
  actorCpf: string | null;
  role: OperationsRole;
  permissions: OperationsPermission[];
  legacyRoleId?: LegacyPanelRoleId | null;
  legacyRoleName?: LegacyPanelRoleName | null;
  legacyResources?: LegacyPanelResource[];
  children: React.ReactNode;
};

type PainelNavItem = {
  href: string;
  label: string;
  icon: string;
  roles?: LegacyPanelRoleId[];
  resources?: LegacyPanelResource[];
};

const navItems: PainelNavItem[] = [
  {
    href: "/painel",
    label: "Vis\u00e3o geral",
    icon: "overview",
    roles: [1, 2],
  },
  {
    href: "/painel/site",
    label: "Site",
    icon: "site",
    roles: [1, 2],
    resources: ["vis_info", "vis_param"],
  },
  {
    href: "/painel/agenda",
    label: "Agenda",
    icon: "calendar",
    roles: [1],
    resources: ["vis_agenda"],
  },
  {
    href: "/painel/passaportes-itens",
    label: "Passaportes e itens",
    icon: "products",
    roles: [1, 2],
    resources: ["vis_agenda", "vis_tabpre"],
  },
  {
    href: "/painel/bilheteria",
    label: "Bilheteria",
    icon: "ticket",
    roles: [1, 2, 3],
    resources: ["vis_bilhet"],
  },
  {
    href: "/painel/compras",
    label: "Compras",
    icon: "cart",
    roles: [1, 2],
    resources: ["vis_compra"],
  },
  {
    href: "/painel/descontos",
    label: "Descontos",
    icon: "discount",
    roles: [1],
    resources: ["vis_desc"],
  },
  {
    href: "/painel/cortesias",
    label: "Cortesias",
    icon: "gift",
    roles: [1],
    resources: ["vis_cort"],
  },
  {
    href: "/painel/cod-indica",
    label: "C\u00f3digos de indica\u00e7\u00e3o",
    icon: "share",
    roles: [1],
    resources: ["vis_indica"],
  },
  {
    href: "/painel/administrativo",
    label: "Administrativo",
    icon: "admin",
    roles: [1],
    resources: [
      "vis_usu",
      "vis_situsu",
      "vis_tabpre",
      "vis_catsoc",
      "vis_socio",
      "vis_param",
    ],
  },
];

function PanelIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    overview: (
      <>
        <path d="M4 13h6v7H4z" />
        <path d="M14 4h6v16h-6z" />
        <path d="M4 4h6v5H4z" />
      </>
    ),
    events: (
      <>
        <path d="M5 5h14v15H5z" />
        <path d="M8 3v4M16 3v4M5 10h14" />
        <path d="M9 14h2M13 14h2M9 17h2" />
      </>
    ),
    site: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
      </>
    ),
    calendar: (
      <>
        <path d="M5 5h14v15H5z" />
        <path d="M8 3v4M16 3v4M5 10h14" />
      </>
    ),
    products: (
      <>
        <path d="M4 7h16v10H4z" />
        <path d="M8 7V5h8v2M8 11h8M8 14h5" />
      </>
    ),
    ticket: (
      <>
        <path d="M4 8a2 2 0 0 0 0 4v4h16v-4a2 2 0 0 0 0-4V4H4z" />
        <path d="M9 8h6M9 12h6" />
      </>
    ),
    cart: (
      <>
        <path d="M4 5h2l2 10h9l2-7H7" />
        <circle cx="10" cy="19" r="1.5" />
        <circle cx="17" cy="19" r="1.5" />
      </>
    ),
    users: (
      <>
        <path d="M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a6 6 0 0 1 12 0" />
        <path d="M17 11a3 3 0 1 0 0-6M15 16a5 5 0 0 1 5 5" />
      </>
    ),
    discount: (
      <>
        <path d="M20 12 12 20 4 12V4h8z" />
        <path d="M9 9h.01M15 15h.01M15 9l-6 6" />
      </>
    ),
    gift: (
      <>
        <path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13" />
        <path d="M12 7c-2.5 0-4-1-4-2.5A2 2 0 0 1 12 7ZM12 7c2.5 0 4-1 4-2.5A2 2 0 0 0 12 7Z" />
      </>
    ),
    share: (
      <>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m8.6 10.7 6.8-4.4M8.6 13.3l6.8 4.4" />
      </>
    ),
    admin: (
      <>
        <path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6z" />
        <path d="M9 12l2 2 4-5" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.9}
      viewBox="0 0 24 24"
    >
      {paths[name] ?? paths.overview}
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.4}
      viewBox="0 0 24 24"
    >
      <path d={open ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );
}

export function PainelShell({
  actorName,
  actorCpf,
  role,
  legacyRoleId,
  legacyRoleName,
  legacyResources = [],
  children,
}: PainelShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingLogout, setPendingLogout] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const visibleItems = useMemo(
    () =>
      navItems.filter((item) => {
        if (item.roles && (!legacyRoleId || !item.roles.includes(legacyRoleId))) {
          return false;
        }

        return item.resources
          ? hasLegacyPanelResource(legacyResources, item.resources)
          : true;
      }),
    [legacyResources, legacyRoleId],
  );

  async function handleLogout() {
    setPendingLogout(true);

    try {
      await fetch("/api/ops/session", {
        method: "DELETE",
      });
    } finally {
      router.replace("/painel/login");
      router.refresh();
      setPendingLogout(false);
    }
  }

  return (
    <div className="estancia-panel min-h-screen bg-[linear-gradient(180deg,#f8f5ef_0%,#fbfaf7_32%,#ffffff_100%)] text-[#17312d]">
      <div
        className={`grid min-h-screen transition-[grid-template-columns] duration-200 ${
          sidebarCollapsed
            ? "lg:grid-cols-[88px_minmax(0,1fr)]"
            : "lg:grid-cols-[248px_minmax(0,1fr)]"
        }`}
      >
        <aside
          className={`flex flex-col border-r border-[rgba(35,73,63,0.12)] bg-[#17342d] text-white transition-all duration-200 ${
            menuOpen ? "block" : "hidden lg:flex"
          }`}
        >
          <div
            className={`flex min-h-[92px] items-center border-b border-white/10 px-3 py-3 ${
              sidebarCollapsed ? "justify-center" : "justify-between"
            }`}
          >
            <div
              className={`min-w-0 overflow-hidden transition-all ${
                sidebarCollapsed ? "w-16" : "w-[230px]"
              }`}
            >
              <EstanciaLogo
                href="/painel"
                compact
                light
                stacked={sidebarCollapsed}
                className={
                  sidebarCollapsed
                    ? "h-16 w-16 max-w-none"
                    : "h-[64px] max-w-[200px]"
                }
              />
            </div>

            <button
              type="button"
              aria-label="Alternar menu mobile"
              onClick={() => setMenuOpen((current) => !current)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-white/15 bg-white/6 text-xl lg:hidden"
            >
              =
            </button>
          </div>

          <div className={`px-3 py-4 ${sidebarCollapsed ? "px-2" : ""}`}>
            <div
              className={`border-b border-white/10 pb-4 ${
                sidebarCollapsed ? "px-0 text-center" : "px-2"
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9fb9b3]">
                Operador
              </p>
              <p
                className={`mt-1 truncate text-sm font-bold text-white ${
                  sidebarCollapsed ? "hidden" : ""
                }`}
              >
                {actorName || actorCpf || "Sess\u00e3o operacional"}
              </p>
              <p
                className={`mt-1 text-xs text-white/65 ${sidebarCollapsed ? "hidden" : ""}`}
              >
                {legacyRoleName || role}
              </p>
              <p
                className={`mt-2 text-[11px] uppercase tracking-[0.14em] text-white/48 ${
                  sidebarCollapsed ? "hidden" : ""
                }`}
              >
                CPF {actorCpf || "-"}
              </p>
              <span
                className={`mx-auto mt-2 flex h-9 w-9 items-center justify-center rounded-[8px] bg-white/10 text-sm font-black ${
                  sidebarCollapsed ? "" : "hidden"
                }`}
              >
                {(actorName || actorCpf || "O").charAt(0).toUpperCase()}
              </span>
            </div>

            <nav
              className={`${menuOpen ? "mt-4 grid" : "mt-4 hidden"} gap-1.5 lg:grid`}
            >
              {visibleItems.map((item) => {
                const active = isPainelShellNavItemActive(pathname, item);

                return (
                  <Link
                    key={item.href}
                    title={sidebarCollapsed ? item.label : undefined}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={`min-h-10 border-l-4 text-[13px] font-semibold transition ${
                      active
                        ? "border-[#efe7d9] bg-white/10 text-white"
                        : "border-transparent text-white/72 hover:bg-white/6 hover:text-white"
                    } ${
                      sidebarCollapsed
                        ? "flex items-center justify-center px-0 py-2 text-center"
                        : "flex items-center gap-3 px-4 py-2.5"
                    }`}
                  >
                    <PanelIcon name={item.icon} />
                    <span className={sidebarCollapsed ? "hidden" : ""}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto border-t border-white/10 px-3 py-4">
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={pendingLogout}
              className="inline-flex min-h-[42px] w-full items-center justify-center rounded-[8px] border border-white/14 bg-white/8 px-4 text-sm font-bold text-white transition hover:bg-white/14 disabled:opacity-60"
            >
              {pendingLogout
                ? "Saindo..."
                : sidebarCollapsed
                  ? "Sair"
                  : "Encerrar sess\u00e3o"}
            </button>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="border-b border-[rgba(35,73,63,0.08)] bg-white/95 px-4 py-2.5 shadow-[0_10px_30px_rgba(21,48,42,0.06)] backdrop-blur-md md:px-5 lg:px-6">
            <div className="mx-auto flex max-w-[1380px] items-center gap-3">
              <button
                type="button"
                aria-label={
                  sidebarCollapsed
                    ? "Abrir menu lateral"
                    : "Fechar menu lateral"
                }
                onClick={() => {
                  if (window.matchMedia("(min-width: 1024px)").matches) {
                    setSidebarCollapsed((current) => !current);
                  } else {
                    setMenuOpen((current) => !current);
                  }
                }}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-[rgba(35,73,63,0.12)] bg-white text-[#17342d] shadow-[0_10px_22px_rgba(22,47,41,0.08)] hover:bg-[#17342d] hover:text-white"
              >
                <ChevronIcon open={!sidebarCollapsed} />
              </button>

              <div>
                <h1 className="text-[20px] font-bold leading-tight text-[#17342d]">
                  Painel operacional
                </h1>
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[1380px] px-4 py-4 md:px-5 lg:px-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
