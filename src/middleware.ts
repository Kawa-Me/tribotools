import { NextResponse, type NextRequest } from 'next/server';

// This middleware runs on every request.
export function middleware(request: NextRequest) {
  // 1. Check if the 'ref' query parameter exists in the URL.
  const refCode = request.nextUrl.searchParams.get('ref');

  // 2. If it doesn't exist, we don't need to do anything.
  // We just let the request proceed as normal by returning.
  if (!refCode) {
    return NextResponse.next();
  }

  // 3. If 'ref' exists, create a response to set the cookie.
  const response = NextResponse.next();
  response.cookies.set({
    name: 'affiliate_ref',
    value: refCode,
    path: '/', // Make the cookie available on all pages
    maxAge: 60 * 60 * 24 * 30, // 30 days in seconds
    httpOnly: true, // For security, prevent client-side script access
    sameSite: 'lax', // Recommended for modern browsers
  });
  
  console.log(`[middleware] Affiliate cookie set for ref: ${refCode}`);

  return response;
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    // Apply this middleware to all paths except for API routes, Next.js specific paths, and static files.
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
