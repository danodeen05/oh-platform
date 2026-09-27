import { clerkMiddleware, createRouteMatcher, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextFetchEvent, NextRequest } from 'next/server'
import { expireForeignHandshakeCookies, withoutForeignHandshakeCookies } from './lib/clerk-foreign-cookies'

// Allowed admin email addresses
const ALLOWED_ADMINS = [
  'danodeen@me.com',
  'danodeen@gmail.com',
]

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/unauthorized(.*)'])

const withClerk = clerkMiddleware(async (auth, request) => {
  // Skip auth entirely in development
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next()
  }

  // Allow public routes (sign-in, unauthorized page)
  if (isPublicRoute(request)) {
    return NextResponse.next()
  }

  // Require authentication
  const { userId } = await auth.protect()

  // Fetch user details to get email (works with SSO/social login)
  const client = await clerkClient()
  const user = await client.users.getUser(userId)

  // Get primary email address
  const primaryEmail = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId
  )?.emailAddress

  if (!primaryEmail || !ALLOWED_ADMINS.includes(primaryEmail.toLowerCase())) {
    // Redirect unauthorized users
    const url = new URL('/unauthorized', request.url)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
})

// On a test Clerk key, prod's ".ohbeef.com" handshake cookies would make
// clerkMiddleware throw before our handler runs. See lib/clerk-foreign-cookies.ts.
export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  const cleaned = withoutForeignHandshakeCookies(request)
  const response = await withClerk(cleaned ?? request, event)
  if (cleaned && response) expireForeignHandshakeCookies(response, request)
  return response
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
}
