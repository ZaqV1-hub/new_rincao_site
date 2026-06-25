import type { Metadata } from "next";
import { AboutPage } from "@/components/about-page";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata("quem-somos");

export default function QuemSomosPage() {
  return <AboutPage />;
}
