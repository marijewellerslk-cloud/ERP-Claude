import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/register'];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // For SSR, check for refresh token cookie
  const refreshToken = request.cookies.get('refreshToken');
  const hasRefreshToken = !!refreshToken?.value;

  // If authenticated (has cookie) and trying to access login, redirect to dashboard
  if (isPublicRoute && hasRefreshToken) {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // Let all other requests through - client-side auth (useAuth hook in
  // dashboard layout) handles protection for dashboard routes via
  // localStorage/Zustand. The refreshToken cookie is set by the API
  // (localhost:4000) and may not be visible to this middleware
  // (localhost:3000) due to cross-port cookie restrictions in dev.
  return NextResponse.next();
}

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
};
