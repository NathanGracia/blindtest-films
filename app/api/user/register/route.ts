import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, signUserToken } from '@/lib/userAuth';

const SESSION_DURATION = 30 * 24 * 60 * 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Pseudo et mot de passe requis' }, { status: 400 });
    }

    const normalized = username.trim().toLowerCase();

    if (normalized.length < 2 || normalized.length > 20) {
      return NextResponse.json({ error: 'Pseudo : 2 à 20 caractères' }, { status: 400 });
    }

    if (!/^[a-z0-9_-]+$/.test(normalized)) {
      return NextResponse.json({ error: 'Pseudo : lettres, chiffres, _ et - uniquement' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Mot de passe : 6 caractères minimum' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { username: normalized } });
    if (existing) {
      return NextResponse.json({ error: 'Ce pseudo est déjà pris' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: { username: normalized, passwordHash },
      select: { id: true, username: true, displayName: true, avatarFile: true, isAdmin: true },
    });

    const token = signUserToken(user.id);
    const response = NextResponse.json({ user });
    response.cookies.set('blindtoss_user_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION,
    });
    return response;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('[REGISTER] Erreur:', msg, stack);
    return NextResponse.json(
      { error: 'Erreur serveur', detail: msg },
      { status: 500 }
    );
  }
}
