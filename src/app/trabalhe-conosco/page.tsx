import type { Metadata } from "next";
import { CareersPage } from "@/components/careers-page";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata("trabalhe-conosco");

export default function TrabalheConoscoPage() {
  return <CareersPage />;
}
