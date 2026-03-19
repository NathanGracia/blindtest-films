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
