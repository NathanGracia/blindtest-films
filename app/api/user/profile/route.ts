import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/sharedAuth';
import { prisma } from '@/lib/prisma';

// Mot de passe et avatar se gèrent désormais sur cooloss (source de vérité
// partagée) — cette route ne touche plus que displayName, propre à
// Blindtoss et absent des claims partagés.
export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });

    const { displayName } = await request.json();
    if (displayName === undefined) {
      return NextResponse.json({ error: 'Aucune modification' }, { status: 400 });
    }

    const name = displayName?.trim() || null;
    if (name && (name.length < 2 || name.length > 20)) {
      return NextResponse.json({ error: 'Pseudo : 2 à 20 caractères' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { displayName: name },
      select: { id: true, username: true, displayName: true, avatarFile: true },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error('[PROFILE] Erreur:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
