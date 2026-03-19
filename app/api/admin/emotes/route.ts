import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const emotes = await prisma.emote.findMany({ orderBy: { code: 'asc' } });
    return NextResponse.json(emotes);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { code, emoji } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'Code requis' }, { status: 400 });
    }

    if (!/^[a-z0-9_]+$/.test(code)) {
      return NextResponse.json({ error: 'Code invalide (minuscules, chiffres et _ uniquement)' }, { status: 400 });
    }

    const emote = await prisma.emote.create({ data: { code, emoji: emoji || null } });
    return NextResponse.json(emote, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Ce code existe déjà' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
