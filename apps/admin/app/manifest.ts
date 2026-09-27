import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Oh! Admin", short_name: "Oh! Admin", start_url: "/", display: "standalone",
    background_color: "#1C1B19", theme_color: "#1C1B19",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
