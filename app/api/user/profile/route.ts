import { NextResponse } from 'next/server';
import { getCurrentUser, comparePassword, hashPassword } from '@/lib/userAuth';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });

    const { displayName, currentPassword, newPassword } = await request.json();
    const updates: Record<string, string | null> = {};

    // Mise à jour du pseudo affiché
    if (displayName !== undefined) {
      const name = displayName?.trim() || null;
      if (name && (name.length < 2 || name.length > 20)) {
        return NextResponse.json({ error: 'Pseudo : 2 à 20 caractères' }, { status: 400 });
      }
      updates.displayName = name;
    }

    // Changement de mot de passe
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Mot de passe actuel requis' }, { status: 400 });
      }
      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'Nouveau mot de passe : 6 caractères minimum' }, { status: 400 });
      }
      const full = await prisma.user.findUnique({ where: { id: user.id } });
      if (!full) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
      const valid = await comparePassword(currentPassword, full.passwordHash);
      if (!valid) return NextResponse.json({ error: 'Mot de passe actuel incorrect' }, { status: 401 });
      updates.passwordHash = await hashPassword(newPassword);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Aucune modification' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updates,
      select: { id: true, username: true, displayName: true, avatarFile: true },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error('[PROFILE] Erreur:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
