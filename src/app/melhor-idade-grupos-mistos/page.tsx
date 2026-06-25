import type { Metadata } from "next";
import { InfoPageView } from "@/components/info-page";
import { buildPageMetadata } from "@/lib/site-metadata";
import { infoPages } from "@/lib/site-content";

export const metadata: Metadata = buildPageMetadata(
  "melhor-idade",
  "/melhor-idade",
);

export default function MelhorIdadeGruposMistosLegacyPage() {
  return <InfoPageView page={infoPages["melhor-idade"]} />;
}
