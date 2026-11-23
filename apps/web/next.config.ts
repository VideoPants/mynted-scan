import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  register: false,
});

const nextConfig: NextConfig = {
  transpilePackages: ["@mynted/centering-core", "@mynted/card-id"],
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "assets.tcgdex.net" },
      { protocol: "https", hostname: "images.pokemontcg.io" },
      { protocol: "https", hostname: "mynted.me" },
      { protocol: "https", hostname: "cdn.shopify.com" },
    ],
  },
  headers: async () => [
    {
      source: "/opencv/:path*",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
    {
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
  ],
};

export default withSerwist(withNextIntl(nextConfig));
