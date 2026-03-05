import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const entries = await prisma.ladderEntry.findMany({
      where: { weekId: 'all-time' },
      orderBy: { bestScore: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      entries: entries.map((entry, index) => ({
        rank: index + 1,
        pseudo: entry.pseudo,
        bestScore: entry.bestScore,
        gamesPlayed: entry.gamesPlayed,
      })),
    });
  } catch (error) {
    console.error('Erreur lecture ladder:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
