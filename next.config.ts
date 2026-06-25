import path from "node:path";
import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

function getAllowedDevOrigins() {
  const origins = new Set(["localhost", "127.0.0.1", "::1"]);
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const configuredOrigins = process.env.NEXT_ALLOWED_DEV_ORIGINS;

  if (configuredSiteUrl) {
    try {
      origins.add(new URL(configuredSiteUrl).hostname);
    } catch {
      // Ignore invalid URLs in local env files.
    }
  }

  if (configuredOrigins) {
    for (const origin of configuredOrigins.split(",")) {
      const normalizedOrigin = origin.trim();

      if (normalizedOrigin) {
        origins.add(normalizedOrigin);
      }
    }
  }

  return Array.from(origins);
}

const nextConfig: NextConfig = {
  allowedDevOrigins: getAllowedDevOrigins(),
  devIndicators: false,
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...securityHeaders],
      },
    ];
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
