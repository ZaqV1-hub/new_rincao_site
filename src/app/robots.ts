import type { MetadataRoute } from "next";
import { getSiteUrl, robotsForEnvironment } from "@/lib/site-metadata";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  const rules = robotsForEnvironment();

  return {
    rules: rules.index
      ? {
          userAgent: "*",
          allow: "/",
        }
      : {
          userAgent: "*",
          disallow: "/",
        },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
