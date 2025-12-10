import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Define which routes are public (sign-in page)
const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)'])

export default clerkMiddleware(async (auth, request) => {
  // Allow public routes
  if (isPublicRoute(request)) {
    return
  }

  // Protect all other routes - require authentication
  await auth.protect()

  // TODO: Add admin role check here when you set up admin roles in Clerk
  // For now, any authenticated user can access admin (you can restrict this later)
  // Example future implementation:
  // const { sessionClaims } = await auth()
  // const role = sessionClaims?.metadata?.role
  // if (role !== 'admin' && role !== 'staff') {
  //   return Response.redirect(new URL('/unauthorized', request.url))
  // }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
