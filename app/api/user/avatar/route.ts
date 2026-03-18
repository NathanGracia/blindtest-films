import { NextResponse } from 'next/server';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { getCurrentUser } from '@/lib/userAuth';
import { prisma } from '@/lib/prisma';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) return NextResponse.json({ error: 'Aucun fichier' }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Format accepté : JPG, PNG, WebP' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Taille max : 5 Mo' }, { status: 400 });
    }

    const ext = file.type === 'image/webp' ? '.webp' : file.type === 'image/png' ? '.png' : '.jpg';
    const fileName = `user-${user.id}-${Date.now()}${ext}`;
    const avatarsDir = path.join(process.cwd(), 'public', 'avatars');
    const filePath = path.join(avatarsDir, fileName);

    await mkdir(avatarsDir, { recursive: true });

    // Supprimer l'ancienne PP si elle existe
    const existing = await prisma.user.findUnique({ where: { id: user.id }, select: { avatarFile: true } });
    if (existing?.avatarFile) {
      const oldPath = path.join(process.cwd(), 'public', existing.avatarFile);
      await unlink(oldPath).catch(() => {});
    }

    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    const avatarFile = `/avatars/${fileName}`;
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { avatarFile },
      select: { id: true, username: true, displayName: true, avatarFile: true },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error('[AVATAR] Erreur:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
