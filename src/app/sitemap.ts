import type { MetadataRoute } from "next";
import { legacyEvents } from "@/lib/legacy-events-content";
import { getSiteUrl } from "@/lib/site-metadata";
import { registrationPages } from "@/lib/group-registration-content";
import { infoPages } from "@/lib/site-content";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  return [
    {
      url: `${siteUrl}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...Object.values(infoPages).map((page) => ({
      url: `${siteUrl}${page.path}`,
      changeFrequency: "weekly" as const,
      priority: page.path === "/agenda" ? 0.9 : 0.8,
    })),
    ...registrationPages.map((page) => ({
      url: `${siteUrl}${page.path}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    {
      url: `${siteUrl}/evento`,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    ...legacyEvents.map((event) => ({
      url: `${siteUrl}${event.path}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    {
      url: `${siteUrl}/mural`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
