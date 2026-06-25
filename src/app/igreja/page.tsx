import type { Metadata } from "next";
import { InfoPageView } from "@/components/info-page";
import { buildPageMetadata } from "@/lib/site-metadata";
import { infoPages } from "@/lib/site-content";

export const metadata: Metadata = buildPageMetadata("igreja");

export default function IgrejaPage() {
  return <InfoPageView page={infoPages.igreja} />;
}
