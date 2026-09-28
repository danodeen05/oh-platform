"use client";

/**
 * <Sheet> loaded on first open (Task G2a). Sheet is built on framer-motion,
 * about 42 KB gzipped, and a sheet is never part of first paint, so pages
 * import this instead: nothing is downloaded until the sheet first opens (or
 * `preloadSheet()` runs on intent), and after that it stays mounted so its
 * close animation plays. Same props as Sheet.
 */
import dynamic from "next/dynamic";
import { useState } from "react";
import type { SheetProps } from "./Sheet";

const loadSheet = () => import("./Sheet");
const Sheet = dynamic(() => loadSheet().then((m) => m.Sheet), { ssr: false });

/** Starts the download early, e.g. on hover or touch of the sheet's trigger. */
export function preloadSheet(): void {
  void loadSheet();
}

export function LazySheet(props: SheetProps) {
  const [mounted, setMounted] = useState(props.open);
  if (props.open && !mounted) setMounted(true);
  return mounted ? <Sheet {...props} /> : null;
}
