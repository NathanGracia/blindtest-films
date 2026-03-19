import { NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { prisma } from '@/lib/prisma';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_SIZE = 2 * 1024 * 1024; // 2 Mo

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const emoteId = parseInt(id);

    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    if (!file) return NextResponse.json({ error: 'Fichier requis' }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Format non supporté (PNG, JPG, WebP, GIF)' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Fichier trop lourd (max 2 Mo)' }, { status: 400 });
    }

    const ext = file.type === 'image/gif' ? 'gif'
      : file.type === 'image/png' ? 'png'
      : file.type === 'image/webp' ? 'webp'
      : 'jpg';
    const filename = `emote-${emoteId}.${ext}`;
    const filepath = join(process.cwd(), 'public', 'emotes', filename);

    // Supprimer l'ancienne image si elle existe
    const existing = await prisma.emote.findUnique({ where: { id: emoteId } });
    if (existing?.imageFile) {
      const oldPath = join(process.cwd(), 'public', existing.imageFile);
      try { await unlink(oldPath); } catch { /* ignore */ }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    const emote = await prisma.emote.update({
      where: { id: emoteId },
      data: { imageFile: `/emotes/${filename}` },
    });

    return NextResponse.json(emote);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const emoteId = parseInt(id);

    const existing = await prisma.emote.findUnique({ where: { id: emoteId } });
    if (existing?.imageFile) {
      const oldPath = join(process.cwd(), 'public', existing.imageFile);
      try { await unlink(oldPath); } catch { /* ignore */ }
    }

    const emote = await prisma.emote.update({
      where: { id: emoteId },
      data: { imageFile: null },
    });
    return NextResponse.json(emote);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
