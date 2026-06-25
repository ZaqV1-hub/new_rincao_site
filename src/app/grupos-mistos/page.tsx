import type { Metadata } from "next";
import { InfoPageView } from "@/components/info-page";
import { buildPageMetadata } from "@/lib/site-metadata";
import { infoPages } from "@/lib/site-content";

export const metadata: Metadata = buildPageMetadata("grupos-mistos");

export default function GruposMistosPage() {
  return <InfoPageView page={infoPages["grupos-mistos"]} />;
}
