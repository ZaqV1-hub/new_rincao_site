"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { useState } from "react";
import { RincaoLogo } from "@/components/rincao-logo";
import { contact } from "@/lib/site-content";

export function SiteShell({
  children,
  customerMenuHref,
}: {
  children: React.ReactNode;
  customerMenuHref: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";

  const usesStandaloneShell =
    pathname.startsWith("/painel") ||
    pathname === "/agenda" ||
    pathname === "/ingresso/escola" ||
    pathname === "/ingresso/educador" ||
    pathname.startsWith("/agendar/") ||
    pathname.startsWith("/comprar/") ||
    pathname.startsWith("/checkout/") ||
    pathname === "/login" ||
    pathname === "/cadastro" ||
    pathname === "/meus-ingressos" ||
    pathname === "/minha-conta" ||
    pathname.startsWith("/minha-conta/");

  if (usesStandaloneShell) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-[#143b63]">
      <div id="fb-root" />
      <Script
        id="facebook-jssdk"
        strategy="afterInteractive"
        src="https://connect.facebook.net/pt_BR/sdk.js#xfbml=1&version=v23.0"
      />

      <a
        href={contact.whatsapp}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-4 right-4 z-50 md:bottom-[2%] md:right-[2%]"
      >
        <Image
          src="/theme/whatsapp-icon.png"
          alt="WhatsApp"
          width={80}
          height={80}
          className="h-[60px] w-[60px] md:h-[80px] md:w-[80px]"
          style={{ height: "auto" }}
        />
      </a>

      <header
        className="fixed inset-x-0 top-0 z-40 border-b border-[rgba(20,59,99,0.08)] bg-white shadow-[0_10px_30px_rgba(20,59,99,0.06)]"
      >
        <div className="mx-auto grid min-h-[76px] w-[min(1240px,calc(100%-28px))] grid-cols-[auto_1fr] items-center gap-3 py-2 sm:w-[min(1240px,calc(100%-40px))] lg:min-h-[108px] lg:grid-cols-[220px_1fr_220px] lg:gap-5">
          <RincaoLogo
            href="/"
            compact
            className="h-[40px] max-w-[170px] sm:h-[48px] sm:max-w-[210px] lg:h-[62px] lg:max-w-[260px]"
          />

          <button
            type="button"
            aria-label="Abrir menu"
            onClick={() => setMenuOpen((current) => !current)}
            className="flex h-[46px] w-[46px] items-center justify-center justify-self-end rounded-[8px] border border-[#d7e3ee] bg-white text-[22px] font-black text-[#143b63] shadow-[0_12px_28px_rgba(20,59,99,0.1)] lg:hidden"
          >
            =
          </button>

          <nav
            className={`${
              menuOpen ? "block" : "hidden"
            } absolute left-5 right-5 top-[calc(100%+12px)] rounded-[8px] border border-[rgba(20,59,99,0.08)] bg-white p-4 text-left shadow-[0_24px_48px_rgba(20,59,99,0.14)] lg:static lg:col-start-2 lg:row-start-1 lg:block lg:justify-self-center lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}
          >
            <ul className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-center lg:gap-[34px]">
              {[
                ["In\u00edcio", "/#inicio"],
                ["Atra\u00e7\u00f5es", "/#atracoes"],
                ["Eventos", "/#eventos"],
                ["Minha conta", customerMenuHref],
                ["Comprar ingressos", "/agenda"],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="relative py-1 text-[1rem] font-medium text-[#143b63] transition after:absolute after:bottom-[-4px] after:left-0 after:right-0 after:h-0.5 after:origin-center after:scale-x-0 after:bg-current after:transition hover:after:scale-x-100"
                    onClick={() => setMenuOpen(false)}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div aria-hidden className="hidden lg:block" />
        </div>
      </header>

      <main className={isHome ? "pt-[76px] lg:pt-[108px]" : ""}>{children}</main>

      <footer className="border-t border-[rgba(20,59,99,0.08)] bg-[linear-gradient(180deg,rgba(20,59,99,0.03),rgba(20,59,99,0.08))] px-5 py-10 text-left">
        <div className="mx-auto grid max-w-[1240px] gap-7 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
          <div>
            <strong className="block text-[1.1rem] text-[#143b63]">
              Clube Rincão
            </strong>
            <p className="mt-2 max-w-[520px] text-[0.95rem] leading-7 text-[#5f748b]">
              Turismo, lazer e eventos para um dia completo no Clube Rincão.
            </p>
          </div>

          <nav className="flex flex-wrap gap-5 text-[0.96rem] font-bold text-[#143b63]">
            <Link href="/#inicio">{"In\u00edcio"}</Link>
            <Link href="/#atracoes">{"Atra\u00e7\u00f5es"}</Link>
            <Link href="/#eventos">Eventos</Link>
            <Link href={customerMenuHref}>Minha conta</Link>
            <Link href="/agenda">Comprar ingressos</Link>
          </nav>

          <p className="m-0 text-[0.92rem] leading-7 text-[#5f748b]">
            {"\u00a9 2026 Clube Rinc\u00e3o. Todos os direitos reservados."}
          </p>
        </div>
      </footer>
    </div>
  );
}
