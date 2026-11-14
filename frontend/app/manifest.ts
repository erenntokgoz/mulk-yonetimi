import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mülküm",
    short_name: "Mülküm",
    description: "Mülk, kiracı ve kira takibi",
    start_url: "/",
    display: "standalone",
    background_color: "#060a10",
    theme_color: "#0f1a2e",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
