import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function getWeekId(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const weekId = searchParams.get('weekId') || getWeekId();

    const entries = await prisma.ladderEntry.findMany({
      where: { weekId },
      orderBy: { bestScore: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      weekId,
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
