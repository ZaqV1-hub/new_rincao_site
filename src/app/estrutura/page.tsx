import type { Metadata } from "next";
import { StructurePage } from "@/components/structure-page";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata("estrutura");

export default function EstruturaPage() {
  return <StructurePage />;
}
