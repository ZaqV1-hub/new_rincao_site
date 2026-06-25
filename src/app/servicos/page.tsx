import type { Metadata } from "next";
import { ServicesPage } from "@/components/services-page";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata("servicos");

export default function ServicosPage() {
  return <ServicesPage />;
}
