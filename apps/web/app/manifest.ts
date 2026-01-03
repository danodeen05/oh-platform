import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Oh! Beef Noodle House",
    short_name: "Oh! Beef",
    description: "Fresh, handmade noodles and authentic beef dishes",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#7C7A67",
    orientation: "portrait",
    icons: [
      {
        src: "/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        src: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/Oh_Logo_Large.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
    categories: ["food", "restaurant", "ordering"],
    screenshots: [],
    related_applications: [],
    prefer_related_applications: false,
  };
}
