import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateAdminSessionToken } from '@/lib/session-token';

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const session = request.cookies.get('admin_session');

    if (!validateAdminSessionToken(session?.value)) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/admin/:path*',
};
