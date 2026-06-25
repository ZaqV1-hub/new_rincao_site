"use client";

import { EstanciaLogo } from "@/components/estancia-logo";
import type { AuthUser } from "@/lib/auth-contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type IngressoShellProps = {
  children: React.ReactNode;
  active: "schedule" | "buy" | "tickets" | "account" | "auth";
  user?: AuthUser | null;
  variant?: "default" | "checkout";
};

const navItems = [
  {
    key: "schedule" as const,
    label: "Agendamento",
    href: "/agenda",
  },
  {
    key: "buy" as const,
    label: "Comprar",
    href: "/agenda",
  },
  {
    key: "tickets" as const,
    label: "Meus ingressos",
    href: "/meus-ingressos",
  },
  {
    key: "account" as const,
    label: "Meus dados",
    href: "/minha-conta",
  },
];

export function IngressoShell({
  children,
  active,
  user = null,
  variant = "default",
}: IngressoShellProps) {
  const router = useRouter();
  const [logoutPending, setLogoutPending] = useState(false);

  async function handleLogout() {
    setLogoutPending(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } catch (error) {
      console.error("customer-logout-failed", error);
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  if (variant === "checkout") {
    return (
      <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(235,244,229,0.75),transparent_34%),linear-gradient(180deg,#fffdf8_0%,#ffffff_58%)] text-[#073f35]">
        <header className="border-b border-[#edf0ec] bg-white/88 shadow-[0_8px_26px_rgba(18,52,45,0.06)] backdrop-blur-md">
          <div className="relative mx-auto flex min-h-[58px] w-[min(960px,calc(100%-20px))] items-center justify-center py-2 sm:w-[min(960px,calc(100%-28px))] lg:min-h-[72px] lg:justify-between">
            <button
              type="button"
              aria-label="Voltar"
              onClick={() => router.back()}
              className="absolute left-0 grid h-9 w-9 place-items-center rounded-[10px] border border-[#d8dfd7] bg-white text-[24px] font-black leading-none text-[#073f35] shadow-[0_8px_18px_rgba(18,52,45,0.06)] lg:hidden"
            >
              ‹
            </button>

            <div className="lg:w-[240px]">
              <EstanciaLogo
                href="/"
                compact
                className="h-[30px] max-w-[155px] sm:h-[36px] sm:max-w-[185px] lg:h-[46px] lg:max-w-[220px]"
              />
            </div>

            <div className="hidden min-w-[240px] items-center justify-end gap-4 text-right lg:flex">
              {user ? (
                <>
                  <div className="text-[13px] font-bold text-[#073f35]">
                    <p>{user.name}</p>
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={logoutPending}
                      className="mt-1 text-[13px] font-normal text-[#2d6d43] underline underline-offset-2 disabled:opacity-60"
                    >
                      {logoutPending ? "saindo..." : "deslogar"}
                    </button>
                  </div>
                  <span className="grid h-11 w-11 place-items-center rounded-full border border-[#d8dfd7] bg-white text-[#073f35]">
                    <svg
                      width="21"
                      height="21"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 21a8 8 0 0 1 16 0" />
                    </svg>
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </header>

        <main>{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f8f5ef_0%,#fbfaf7_32%,#ffffff_100%)] text-[#17312d]">
      <header className="sticky top-0 z-40 border-b border-[rgba(35,73,63,0.08)] bg-white/95 shadow-[0_10px_30px_rgba(21,48,42,0.06)] backdrop-blur-md">
        <div className="mx-auto grid min-h-[74px] w-[min(1240px,calc(100%-24px))] grid-cols-1 gap-2 py-2 sm:w-[min(1240px,calc(100%-40px))] lg:min-h-[96px] lg:grid-cols-[220px_1fr_220px] lg:items-center lg:gap-3 lg:py-3">
          <div className="flex justify-center lg:justify-start">
            <EstanciaLogo
              href="/"
              compact
              className="h-[34px] max-w-[150px] sm:h-[42px] sm:max-w-[180px] lg:h-[62px] lg:max-w-[260px]"
            />
          </div>

          <div className="flex flex-col items-center gap-2 text-center lg:order-3 lg:items-end lg:text-right">
            {user ? (
              <div className="flex flex-wrap items-center justify-center gap-2 text-[13px] lg:justify-end lg:text-[14px]">
                <span className="max-w-[220px] truncate font-bold text-[#17351f]">
                  {user.name}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={logoutPending}
                  className="text-[#426048] underline underline-offset-2 disabled:opacity-60"
                >
                  {logoutPending ? "saindo..." : "deslogar"}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap justify-center gap-3 text-[13px] lg:text-[14px]">
                <Link
                  href="/login"
                  className="text-[#426048] underline underline-offset-2"
                >
                  entrar
                </Link>
                <Link
                  href="/cadastro"
                  className="text-[#426048] underline underline-offset-2"
                >
                  criar conta
                </Link>
              </div>
            )}

            <Link
              href="/"
              className="inline-flex min-h-[38px] items-center justify-center rounded-full border border-[rgba(35,73,63,0.12)] bg-[rgba(35,73,63,0.04)] px-4 text-[13px] font-bold text-[#17342d] hover:bg-[#17342d] hover:text-white lg:min-h-[42px] lg:px-5 lg:text-[14px]"
            >
              Voltar para o site
            </Link>
          </div>

          <nav className="order-3 lg:order-none lg:justify-self-center">
            <ul className="flex flex-nowrap items-center justify-start gap-5 overflow-x-auto px-1 pb-1 text-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-wrap lg:justify-center lg:gap-8 lg:overflow-visible lg:px-0 lg:pb-0">
              {navItems.map((item) => {
                const isActive =
                  item.key === active ||
                  (active === "auth" &&
                    (item.key === "schedule" || item.key === "buy"));

                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className={`relative whitespace-nowrap py-1 text-[0.92rem] font-bold transition after:absolute after:bottom-[-4px] after:left-0 after:right-0 after:h-0.5 after:origin-center after:bg-current after:transition lg:text-[0.96rem] ${
                        isActive
                          ? "text-[#17342d] after:scale-x-100"
                          : "text-[#5e746e] after:scale-x-0 hover:text-[#17342d] hover:after:scale-x-100"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </header>

      <main className="pb-12">{children}</main>
    </div>
  );
}
