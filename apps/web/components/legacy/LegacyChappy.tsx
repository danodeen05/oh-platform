"use client";

import dynamic from "next/dynamic";

// The floating legacy Chappy widget, client-only (it reads localStorage and
// portals into <body>). Moved here from components/Providers.tsx in Task C4.
const ChappyChatWrapper = dynamic(() => import("@/components/ChappyChatWrapper"), { ssr: false });

export function LegacyChappy() {
  return <ChappyChatWrapper />;
}
