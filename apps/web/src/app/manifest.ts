import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyntedScan",
    short_name: "MyntedScan",
    description: "Measure Pokémon card centering on your device.",
    start_url: "/en/scan",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#131921",
    icons: [
      {
        src: "/brand/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}