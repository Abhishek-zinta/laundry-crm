import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const SESSION_COOKIE = 'ro_session';
const PUBLIC_PREFIXES = ['/login', '/register', '/book'];

/**
 * Fast redirect for signed-out visitors. This only checks that a session
 * cookie exists; the API validates the session on every request.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (!isPublic && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|svg|ico|webp)$).*)'],
};
