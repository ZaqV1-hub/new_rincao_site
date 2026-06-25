import type { Metadata } from "next";
import { getInfoPage } from "@/lib/site-content";

const productionSiteUrl = "https://www.estancia.local";
const brandName = "Estancia";

export function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? productionSiteUrl;
}

export function buildPageMetadata(slug: string, pathOverride?: string): Metadata {
  const page = getInfoPage(slug);
  const title = `${page.title} - ${brandName}`;

  return {
    title,
    description: page.seoDescription,
    alternates: {
      canonical: pathOverride ?? page.path,
    },
    openGraph: {
      title,
      description: page.seoDescription,
      url: pathOverride ?? page.path,
      siteName: brandName,
      type: "website",
      images: page.heroImage
        ? [
            {
              url: page.heroImage.src,
              alt: page.heroImage.alt,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: page.seoDescription,
      images: page.heroImage ? [page.heroImage.src] : undefined,
    },
  };
}

export function robotsForEnvironment() {
  const siteUrl = getSiteUrl();
  const isPreview =
    process.env.VERCEL_ENV === "preview" ||
    siteUrl.includes("questione.ai") ||
    siteUrl.includes("localhost");

  return {
    index: !isPreview,
    follow: !isPreview,
  };
}
