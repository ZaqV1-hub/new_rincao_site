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
  title: "Rincão em São Paulo",
  description:
    "Novo institucional do Rincão em Next.js, com páginas públicas, segmentos de atendimento e convivência inicial com o domínio transacional `/ingresso`.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Rincão em São Paulo",
    description:
      "Conheça o novo institucional do Rincão, com estrutura, segmentos e canais de atendimento.",
    siteName: "Rincão",
    type: "website",
    images: [
      {
        url: "/photos/day-use.jpg",
        alt: "Área verde do Rincão",
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
