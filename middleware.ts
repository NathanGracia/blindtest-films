import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE = 'blindtest_admin_session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Vérifier si c'est une route admin (sauf login)
  const isAdminRoute = pathname.startsWith('/admin') && !pathname.startsWith('/admin/login');
  const isAdminApi = pathname.startsWith('/api/admin');

  if (isAdminRoute || isAdminApi) {
    const session = request.cookies.get(SESSION_COOKIE);

    if (!session?.value) {
      // Rediriger vers login pour les pages, retourner 401 pour les API
      if (isAdminApi) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    // Vérifier l'expiration du token
    try {
      const [, expiresAt] = session.value.split(':');
      const expiration = parseInt(expiresAt, 10);

      if (Date.now() > expiration) {
        // Session expirée
        const response = isAdminApi
          ? NextResponse.json({ error: 'Session expirée' }, { status: 401 })
          : NextResponse.redirect(new URL('/admin/login', request.url));

        response.cookies.delete(SESSION_COOKIE);
        return response;
      }
    } catch {
      // Token invalide
      if (isAdminApi) {
        return NextResponse.json({ error: 'Session invalide' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
