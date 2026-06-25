import type { Metadata } from "next";
import { LegacyMuralPage } from "@/components/legacy-mural-page";

type PageProps = {
  params: Promise<{
    slug?: string[];
  }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const requestedSlug = slug?.[0];

  return {
    title: "Mural Legado - Rincao",
    description: requestedSlug
      ? `Arquivo do mural legado para o slug ${requestedSlug}, preservado no novo institucional do Rincao.`
      : "Arquivo centralizado do mural legado preservado no novo institucional do Rincao.",
    alternates: {
      canonical: requestedSlug ? `/mural/${requestedSlug}` : "/mural",
    },
  };
}

export default async function LegacyMuralRoute({ params }: PageProps) {
  const { slug } = await params;
  const requestedSlug = slug?.[0] ?? null;

  return <LegacyMuralPage requestedSlug={requestedSlug} />;
}
