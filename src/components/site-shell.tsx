"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { useState } from "react";
import { RincaoLogo } from "@/components/rincao-logo";
import { contact } from "@/lib/site-content";

const marketingNav = [
  { href: "/", label: "Início" },
  { href: "/servicos", label: "Segmentos" },
  { href: "/escola", label: "Escola" },
  { href: "/confraternizacoes", label: "Confraternizações" },
  { href: "/localizacao", label: "Localização" },
];

export function SiteShell({
  children,
  customerMenuHref,
}: {
  children: React.ReactNode;
  customerMenuHref: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

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

  const navItems = [
    ...marketingNav,
    { href: customerMenuHref, label: "Minha conta" },
    { href: "/agenda", label: "Comprar ingressos" },
  ];

  if (usesStandaloneShell) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f6f8fb] text-[#12344f]">
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
        className="fixed bottom-5 right-5 z-50 rounded-full bg-white p-2 shadow-[0_18px_34px_rgba(18,52,79,0.18)] transition hover:scale-[1.03]"
      >
        <Image
          src="/theme/whatsapp-icon.png"
          alt="WhatsApp"
          width={72}
          height={72}
          className="h-[60px] w-[60px]"
        />
      </a>

      <header className="fixed inset-x-0 top-0 z-40 border-b border-[#d8e2eb]/80 bg-white">
        <div className="mx-auto flex min-h-[92px] w-[min(1240px,calc(100%-32px))] items-center justify-between gap-4 py-4">
          <RincaoLogo
            href="/"
            compact
            className="h-[46px] max-w-[184px] md:h-[54px] md:max-w-[220px]"
          />

          <nav className="hidden items-center gap-8 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`relative py-1 text-[0.95rem] font-semibold transition after:absolute after:bottom-[-6px] after:left-0 after:right-0 after:h-[2px] after:origin-center after:bg-current after:transition ${
                  pathname === item.href
                    ? "text-[#1d6fb8] after:scale-x-100"
                    : "text-[#12344f] hover:text-[#1d6fb8] after:scale-x-0 hover:after:scale-x-100"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex lg:items-center lg:gap-3">
            <a
              href={contact.whatsapp}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-[#d8e2eb] px-7 text-[0.95rem] font-bold text-[#12344f] transition hover:border-[#bed1e1] hover:bg-[#f3f7fb]"
            >
              WhatsApp
            </a>
            <Link href="/agenda" className="rincao-button min-h-[48px]">
              Agenda e compra
            </Link>
          </div>

          <button
            type="button"
            aria-label="Abrir menu"
            onClick={() => setMenuOpen((current) => !current)}
            className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] border border-[#d8e2eb] bg-white text-[1.5rem] font-bold text-[#12344f] shadow-[0_12px_28px_rgba(18,52,79,0.08)] lg:hidden"
          >
            {menuOpen ? "×" : "≡"}
          </button>
        </div>

        {menuOpen ? (
          <div className="border-t border-[#d8e2eb] bg-white lg:hidden">
            <div className="mx-auto flex w-[min(1240px,calc(100%-32px))] flex-col gap-2 py-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-[14px] px-4 py-3 text-[0.96rem] font-semibold text-[#12344f] transition hover:bg-[#eef4f9] hover:text-[#1d6fb8]"
                >
                  {item.label}
                </Link>
              ))}
              <a
                href={contact.whatsapp}
                target="_blank"
                rel="noreferrer"
                onClick={() => setMenuOpen(false)}
                className="rincao-button mt-2 justify-center"
              >
                Falar no WhatsApp
              </a>
            </div>
          </div>
        ) : null}
      </header>

      <main className="pt-[92px]">{children}</main>

      <footer className="bg-[#0f2d47] px-5 py-14 text-white">
        <div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1.1fr]">
          <div className="text-left">
            <RincaoLogo
              href="/"
              compact
              className="h-[54px] max-w-[220px] brightness-[1.06]"
            />
          </div>

          <div className="text-left">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/48">
              Páginas
            </p>
            <div className="mt-4 flex flex-col gap-3 text-[0.95rem] text-white/78">
              {marketingNav.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-white">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="text-left">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/48">
              Segmentos
            </p>
            <div className="mt-4 flex flex-col gap-3 text-[0.95rem] text-white/78">
              <Link href="/escola" className="hover:text-white">
                Escola
              </Link>
              <Link href="/igreja" className="hover:text-white">
                Igreja
              </Link>
              <Link href="/ongs" className="hover:text-white">
                ONGs
              </Link>
              <Link href="/grupos-mistos" className="hover:text-white">
                Grupos mistos
              </Link>
            </div>
          </div>

          <div className="text-left">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/48">
              Contato
            </p>
            <div className="mt-4 space-y-3 text-[0.95rem] leading-7 text-white/78">
              <p>{contact.address}</p>
              <p>{contact.phones[0]}</p>
              <a
                href={contact.whatsapp}
                target="_blank"
                rel="noreferrer"
                className="inline-flex text-white hover:text-[#d99f55]"
              >
                WhatsApp oficial
              </a>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-[1240px] flex-col gap-3 border-t border-white/10 pt-6 text-left text-[0.88rem] text-white/48 md:flex-row md:items-center md:justify-between">
          <p>© 2026 Clube Rincão. Todos os direitos reservados.</p>
          <div className="flex flex-wrap gap-4">
            <Link href={customerMenuHref} className="hover:text-white">
              Minha conta
            </Link>
            <Link href="/agenda" className="hover:text-white">
              Comprar ingressos
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
