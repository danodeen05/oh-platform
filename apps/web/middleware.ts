import { clerkMiddleware, createRouteMatcher, clerkClient } from "@clerk/nextjs/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextRequest, NextResponse } from "next/server";

const intlMiddleware = createIntlMiddleware(routing);

// Allowed kiosk user email addresses
const ALLOWED_KIOSK_USERS = [
  "danodeen@me.com",
  "danodeen@gmail.com",
];

// Protected routes that require authentication (with locale prefix)
const isProtectedRoute = createRouteMatcher([
  "/:locale/member(.*)",
  "/:locale/referral(.*)",
  "/:locale/kiosk",
  "/:locale/kiosk/(.*)",
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
  "/:locale/kiosk-unauthorized(.*)",
]);

// Check if this is a kiosk route (excludes kiosk-unauthorized)
const isKioskRoute = createRouteMatcher(["/:locale/kiosk", "/:locale/kiosk/(.*)"]);

export default clerkMiddleware(async (auth, request: NextRequest) => {
  // Run the intl middleware first to handle locale routing
  const response = intlMiddleware(request);

  // Check if this is a protected route
  if (isProtectedRoute(request)) {
    const { userId } = await auth.protect();

    // For kiosk routes, verify user is in allowlist
    if (isKioskRoute(request) && userId) {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);

      const primaryEmail = user.emailAddresses.find(
        (email) => email.id === user.primaryEmailAddressId
      )?.emailAddress;

      if (!primaryEmail || !ALLOWED_KIOSK_USERS.includes(primaryEmail.toLowerCase())) {
        // Extract locale from URL path
        const locale = request.nextUrl.pathname.split("/")[1] || "en";
        const url = new URL(`/${locale}/kiosk-unauthorized`, request.url);
        return NextResponse.redirect(url);
      }
    }
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
