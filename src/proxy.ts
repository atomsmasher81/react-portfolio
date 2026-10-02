import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const response = NextResponse.next()

  // Add security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin')
  // The camera for this site's own pages only: the Magic Theatre's mirror asks for it
  // (only after the visitor agrees), and it's reachable from any page without a reload.
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()')

  const { pathname } = request.nextUrl
  if (pathname === '/sitemap.xml') {
    // Next sets the sitemap's Cache-Control itself.
  } else if (/(^|\/)(opengraph|twitter)-image(\.\w+)?$|\.(js|css|svg|png|jpe?g|gif|ico|webp|avif|ttf|otf|woff2?)$/.test(pathname)) {
    // Share cards (Next 16 leaves them at max-age=0) and files from /public, which
    // keep their name when they change, so they can't be immutable: fresh for a
    // day, then served while a fresh copy is fetched.
    response.headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
  } else {
    // Pages and the RSC payloads behind client-side navigation. Browsers check
    // back every time (a cheap 304 when nothing changed), so nobody sees an old
    // page after a deploy; a CDN may keep them for 5 minutes. No
    // stale-while-revalidate here: Chrome applies it to the RSC fetches too,
    // and would keep serving a stale payload for as long as it allows.
    response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=300, must-revalidate')
  }

  return response
}

// Configure which routes to run the proxy (formerly middleware) on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
} 