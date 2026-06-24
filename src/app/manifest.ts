import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RK Global Fabric ERP",
    short_name: "Fabric ERP",
    description: "ERP for polymer fabric manufacturing",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1e1b4b", // Indigo-950 theme color
    icons: [
      {
        src: "/rk-global-logo.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/rk-global-logo.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
