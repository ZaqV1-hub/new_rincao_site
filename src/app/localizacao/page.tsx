import type { Metadata } from "next";
import { LocationPage } from "@/components/location-page";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata("localizacao");

export default function LocalizacaoPage() {
  return <LocationPage />;
}
