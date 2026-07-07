import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySharedTokenEdge } from '@/lib/sharedAuthEdge';

const SHARED_SESSION_COOKIE = 'nathangracia_session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminRoute = pathname.startsWith('/admin');
  const isAdminApi = pathname.startsWith('/api/admin');

  if (isAdminRoute || isAdminApi) {
    const token = request.cookies.get(SHARED_SESSION_COOKIE)?.value;
    const claims = await verifySharedTokenEdge(token);

    if (!claims || !claims.isAdmin) {
      if (isAdminApi) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
