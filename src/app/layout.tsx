import type { Metadata } from "next";
import { Rubik, Salsa } from "next/font/google";
import "./globals.css";
import { SiteShell } from "@/components/site-shell";
import { getAuthSession } from "@/lib/auth-session";
import { getSiteUrl, robotsForEnvironment } from "@/lib/site-metadata";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
});

const salsa = Salsa({
  variable: "--font-salsa",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "Estancia em Sao Paulo",
  description:
    "Novo institucional do Estancia em Next.js, com paginas publicas, segmentos de atendimento e convivencia inicial com o dominio transacional `/ingresso`.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Estancia em Sao Paulo",
    description:
      "Conheca o novo institucional do Estancia, com estrutura, segmentos e canais de atendimento.",
    siteName: "Estancia",
    type: "website",
    images: [
      {
        url: "/photos/day-use.jpg",
        alt: "Area verde do Estancia",
      },
    ],
  },
  robots: robotsForEnvironment(),
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getAuthSession();
  const customerMenuHref = session
    ? "/minha-conta"
    : "/login?redirect=%2Fminha-conta";

  return (
    <html
      lang="pt-BR"
      className={`${rubik.variable} ${salsa.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <SiteShell customerMenuHref={customerMenuHref}>{children}</SiteShell>
      </body>
    </html>
  );
}
