import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { comparePassword, signUserToken } from '@/lib/userAuth';

const SESSION_DURATION = 30 * 24 * 60 * 60; // 30 jours en secondes

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Pseudo et mot de passe requis' }, { status: 400 });
    }

    const normalized = username.trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { username: normalized } });
    if (!user) {
      return NextResponse.json({ error: 'Pseudo ou mot de passe incorrect' }, { status: 401 });
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Pseudo ou mot de passe incorrect' }, { status: 401 });
    }

    const token = signUserToken(user.id);
    const response = NextResponse.json({ user: { id: user.id, username: user.username, displayName: user.displayName, avatarFile: user.avatarFile, isAdmin: user.isAdmin } });
    response.cookies.set('blindtoss_user_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION,
    });

    // Si admin : poser aussi le cookie admin pour accéder au back-office
    if (user.isAdmin) {
      const adminExpiresAt = Date.now() + SESSION_DURATION * 1000;
      const adminToken = `admin:${adminExpiresAt}`;
      response.cookies.set('blindtoss_admin_session', adminToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_DURATION,
      });
    }

    return response;
  } catch (error) {
    console.error('[LOGIN] Erreur:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
