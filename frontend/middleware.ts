import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public routes that don't need authentication
const PUBLIC_PATHS = ['/login', '/register', '/auth/callback'];

// Role-based path prefixes
const ROLE_PATHS: Record<string, string[]> = {
  admin: ['/admin'],
  agent_l1: ['/agent'],
  agent_l2: ['/agent'],
  agent_l3: ['/agent'],
  customer: ['/dashboard', '/tickets'],
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and Next.js internals
  if (
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Check for refresh token in localStorage via cookie (we store it as a JS-accessible cookie for middleware)
  // The middleware can only read cookies, not localStorage, so we use a 'has_session' cookie
  // set by the client after login to indicate a session exists.
  const hasSession = request.cookies.get('has_session');

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Match all paths except static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)'],
};
