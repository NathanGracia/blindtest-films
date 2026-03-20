import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE = 'blindtoss_admin_session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Vérifier si c'est une route admin (sauf login)
  const isAdminRoute = pathname.startsWith('/admin');
  const isAdminApi = pathname.startsWith('/api/admin');

  if (isAdminRoute || isAdminApi) {
    const session = request.cookies.get(SESSION_COOKIE);

    if (!session?.value) {
      if (isAdminApi) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/', request.url));
    }

    try {
      const [, expiresAt] = session.value.split(':');
      const expiration = parseInt(expiresAt, 10);

      if (Date.now() > expiration) {
        const response = isAdminApi
          ? NextResponse.json({ error: 'Session expirée' }, { status: 401 })
          : NextResponse.redirect(new URL('/', request.url));

        response.cookies.delete(SESSION_COOKIE);
        return response;
      }
    } catch {
      if (isAdminApi) {
        return NextResponse.json({ error: 'Session invalide' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
