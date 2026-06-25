"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { useState } from "react";
import { EstanciaLogo } from "@/components/estancia-logo";
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
    <div className="min-h-screen overflow-x-hidden bg-white text-[#17351f]">
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
        className="fixed inset-x-0 top-0 z-40 border-b border-[rgba(35,73,63,0.08)] bg-white shadow-[0_10px_30px_rgba(21,48,42,0.06)]"
      >
        <div className="mx-auto grid min-h-[76px] w-[min(1240px,calc(100%-28px))] grid-cols-[auto_1fr] items-center gap-3 py-2 sm:w-[min(1240px,calc(100%-40px))] lg:min-h-[108px] lg:grid-cols-[220px_1fr_220px] lg:gap-5">
          <EstanciaLogo
            href="/"
            compact
            className="h-[40px] max-w-[170px] sm:h-[48px] sm:max-w-[210px] lg:h-[62px] lg:max-w-[260px]"
          />

          <button
            type="button"
            aria-label="Abrir menu"
            onClick={() => setMenuOpen((current) => !current)}
            className="flex h-[46px] w-[46px] items-center justify-center justify-self-end rounded-[8px] border border-[#d8e0d4] bg-white text-[22px] font-black text-[#17342d] shadow-[0_12px_28px_rgba(22,47,41,0.1)] lg:hidden"
          >
            =
          </button>

          <nav
            className={`${
              menuOpen ? "block" : "hidden"
            } absolute left-5 right-5 top-[calc(100%+12px)] rounded-[8px] border border-[rgba(35,73,63,0.08)] bg-white p-4 text-left shadow-[0_24px_48px_rgba(19,48,41,0.14)] lg:static lg:col-start-2 lg:row-start-1 lg:block lg:justify-self-center lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}
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
                    className="relative py-1 text-[1rem] font-medium text-[#17342d] transition after:absolute after:bottom-[-4px] after:left-0 after:right-0 after:h-0.5 after:origin-center after:scale-x-0 after:bg-current after:transition hover:after:scale-x-100"
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

      <footer className="border-t border-[rgba(22,47,41,0.08)] bg-[linear-gradient(180deg,rgba(23,52,45,0.04),rgba(23,52,45,0.08))] px-5 py-10 text-left">
        <div className="mx-auto grid max-w-[1240px] gap-7 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
          <div>
            <strong className="block text-[1.1rem] text-[#17342d]">
              {"Est\u00e2ncia e Parque Ecol\u00f3gico das \u00c1guas"}
            </strong>
            <p className="mt-2 max-w-[520px] text-[0.95rem] leading-7 text-[#5e746e]">
              {
                "Turismo, lazer, natureza e eventos em uma experi\u00eancia completa."
              }
            </p>
          </div>

          <nav className="flex flex-wrap gap-5 text-[0.96rem] font-bold text-[#17342d]">
            <Link href="/#inicio">{"In\u00edcio"}</Link>
            <Link href="/#atracoes">{"Atra\u00e7\u00f5es"}</Link>
            <Link href="/#eventos">Eventos</Link>
            <Link href={customerMenuHref}>Minha conta</Link>
            <Link href="/agenda">Comprar ingressos</Link>
          </nav>

          <p className="m-0 text-[0.92rem] leading-7 text-[#5e746e]">
            {"\u00a9 2026 Est\u00e2ncia. Todos os direitos reservados."}
          </p>
        </div>
      </footer>
    </div>
  );
}
