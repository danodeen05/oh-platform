import { notFound } from "next/navigation";
import { Gallery } from "./gallery";

export const metadata = { title: "UI kit" };

/** Dev-only gallery of every console UI component, for visual review. */
export default function UiKitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Gallery />;
}
