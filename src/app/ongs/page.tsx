import type { Metadata } from "next";
import { InfoPageView } from "@/components/info-page";
import { buildPageMetadata } from "@/lib/site-metadata";
import { infoPages } from "@/lib/site-content";

export const metadata: Metadata = buildPageMetadata("ongs");

export default function OngsPage() {
  return <InfoPageView page={infoPages.ongs} />;
}
