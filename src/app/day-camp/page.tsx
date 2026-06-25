import type { Metadata } from "next";
import { InfoPageView } from "@/components/info-page";
import { buildPageMetadata } from "@/lib/site-metadata";
import { infoPages } from "@/lib/site-content";

export const metadata: Metadata = buildPageMetadata(
  "day-use-familia",
  "/day-use-familia",
);

export default function DayCampLegacyPage() {
  return <InfoPageView page={infoPages["day-use-familia"]} />;
}
