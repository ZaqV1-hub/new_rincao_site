import type { Metadata } from "next";
import { InfoPageView } from "@/components/info-page";
import { buildPageMetadata } from "@/lib/site-metadata";
import { infoPages } from "@/lib/site-content";

export const metadata: Metadata = buildPageMetadata(
  "confraternizacoes",
  "/confraternizacoes",
);

export default function ConfraternizacaoLegacyPage() {
  return <InfoPageView page={infoPages.confraternizacoes} />;
}
