// Clerk middleware disabled for local development
// TODO: Re-enable for production with proper ClerkProvider setup in layout.tsx
//
// import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
// const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)'])
// export default clerkMiddleware(async (auth, request) => {
//   if (isPublicRoute(request)) return
//   await auth.protect()
// })

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Allow all requests in development
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
}
