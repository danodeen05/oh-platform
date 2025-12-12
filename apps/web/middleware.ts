import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextRequest, NextResponse } from "next/server";

const intlMiddleware = createIntlMiddleware(routing);

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
]);

export default clerkMiddleware(async (auth, request: NextRequest) => {
  // Run the intl middleware first to handle locale routing
  const response = intlMiddleware(request);

  // Check if this is a protected route
  if (isProtectedRoute(request)) {
    await auth.protect();
  }

  return response;
});

export const config = {
  matcher: [
    // Match all paths except static files and API routes
    "/((?!_next|api|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
