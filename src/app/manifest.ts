import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Family Love Food",
    short_name: "FLF",
    description: "Dieta, compra i tiquets compartits de casa",
    start_url: "/",
    display: "standalone",
    background_color: "#e8dbc4",
    theme_color: "#000000",
    lang: "ca",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
