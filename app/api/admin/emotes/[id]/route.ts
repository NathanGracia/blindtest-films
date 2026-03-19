import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { code, emoji } = await request.json();

    if (code && !/^[a-z0-9_]+$/.test(code)) {
      return NextResponse.json({ error: 'Code invalide' }, { status: 400 });
    }

    const emote = await prisma.emote.update({
      where: { id: parseInt(id) },
      data: {
        ...(code && { code }),
        ...(emoji !== undefined && { emoji: emoji || null }),
      },
    });
    return NextResponse.json(emote);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Ce code existe déjà' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.emote.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
