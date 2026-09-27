import { clerkMiddleware, createRouteMatcher, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextFetchEvent, NextRequest } from 'next/server'
import { expireForeignHandshakeCookies, withoutForeignHandshakeCookies } from './lib/clerk-foreign-cookies'
import { decide, type AdminRole } from './lib/access'
import { devRole, requestHeadersWithRole, resolveRole } from './lib/roles'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/unauthorized(.*)'])

const withClerk = clerkMiddleware(async (auth, request) => {
  let role: AdminRole | null = null
  if (process.env.NODE_ENV === 'development') {
    role = devRole()
  } else if (!isPublicRoute(request)) {
    const { userId } = await auth.protect()
    const user = await (await clerkClient()).users.getUser(userId)
    const email = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress
    role = resolveRole(email, user.publicMetadata as Record<string, unknown>)
  }
  const decision = decide(role, request.nextUrl.pathname)
  if (decision.kind === 'redirect') return NextResponse.redirect(new URL(decision.to, request.url))
  return NextResponse.next({ request: { headers: requestHeadersWithRole(request.headers, role) } })
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
