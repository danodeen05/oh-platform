import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextRequest, NextResponse } from "next/server";

const intlMiddleware = createIntlMiddleware(routing);

// CNY subdomain detection
const CNY_HOSTNAMES = ["cny.ohbeef.com", "cny.localhost"];

// Protected routes that require authentication (with locale prefix)
const isProtectedRoute = createRouteMatcher([
  "/:locale/member(.*)",
  "/:locale/referral(.*)",
]);

// Public routes (with locale prefix)
const isPublicRoute = createRouteMatcher([
  "/:locale",
  "/:locale/sign-in(.*)",
  "/:locale/sign-up(.*)",
  "/:locale/order(.*)",
  "/:locale/menu(.*)",
  "/:locale/locations(.*)",
  "/:locale/loyalty(.*)",
  "/:locale/gift-cards(.*)",
  "/:locale/store(.*)",
  "/:locale/careers(.*)",
  "/:locale/contact(.*)",
  "/:locale/press(.*)",
  "/:locale/privacy(.*)",
  "/:locale/accessibility(.*)",
  "/:locale/tenants(.*)",
  "/:locale/pod(.*)",
  "/:locale/kiosk",
  "/:locale/kiosk/(.*)",
  "/:locale/cny",
  "/:locale/cny/(.*)",
]);

// Check if this is a kiosk route (excludes kiosk-unauthorized)
const isKioskRoute = createRouteMatcher(["/:locale/kiosk", "/:locale/kiosk/(.*)"]);

export default clerkMiddleware(async (auth, request: NextRequest) => {
  const hostname = request.headers.get("host") || "";

  // Handle CNY subdomain routing
  if (CNY_HOSTNAMES.some(h => hostname.startsWith(h.split(".")[0]))) {
    const url = request.nextUrl.clone();
    const pathname = url.pathname;

    // If not already on a CNY path, redirect to CNY
    if (!pathname.includes("/cny")) {
      // Handle root path -> /en/cny
      if (pathname === "/" || pathname === "/en" || pathname === "/en/") {
        url.pathname = "/en/cny";
        return NextResponse.redirect(url);
      }
      // For other paths, prefix with /cny
      const localeMatch = pathname.match(/^\/(en|zh-TW|zh-CN|es)/);
      if (localeMatch) {
        const locale = localeMatch[1];
        const rest = pathname.slice(locale.length + 1);
        url.pathname = `/${locale}/cny${rest}`;
        return NextResponse.redirect(url);
      }
    }
  }

  // Run the intl middleware first to handle locale routing
  const response = intlMiddleware(request);

  // Check if this is a protected route (requires Clerk auth)
  if (isProtectedRoute(request)) {
    await auth.protect();
  }

  // Set x-pathname header for kiosk detection in layout
  if (isKioskRoute(request)) {
    response.headers.set("x-pathname", request.nextUrl.pathname);
  }

  return response;
});

export const config = {
  matcher: [
    // Match all paths except static files and API routes
    "/((?!_next|api|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp4|webm|ogg|mov)).*)",
  ],
};
