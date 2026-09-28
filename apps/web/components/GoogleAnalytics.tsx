"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, Suspense } from "react";
// analytics-core, not lib/analytics: this is in every page's first-load JS (Task G2a).
import { GA_MEASUREMENT_ID, pageview } from "@/lib/analytics-core";

function GoogleAnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const first = useRef(true);

  useEffect(() => {
    if (!pathname || !GA_MEASUREMENT_ID) return;
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    // The landing page is reported by the inline config below once gtag
    // loads (lazyOnload); remember it, since the visitor may have navigated
    // on by then. Later navigations queue their own page view.
    if (first.current) {
      first.current = false;
      window.__ohLandingPath = url;
      return;
    }
    pageview(url);
  }, [pathname, searchParams]);

  return null;
}

export default function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="lazyOnload"
      />
      <Script id="google-analytics" strategy="lazyOnload">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            page_path: window.__ohLandingPath || window.location.pathname,
            send_page_view: true,
          });
        `}
      </Script>
      <Suspense fallback={null}>
        <GoogleAnalyticsTracker />
      </Suspense>
    </>
  );
}
