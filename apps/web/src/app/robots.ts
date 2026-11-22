import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/en", "/ar", "/en/share/", "/ar/share/", "/embed/"],
      disallow: ["/api/", "/en/history", "/ar/history", "/en/dev", "/ar/dev", "/en/sign-in", "/ar/sign-in", "/en/sign-up", "/ar/sign-up", "/en/results", "/ar/results", "/en/scan", "/ar/scan"],
    },
  };
}