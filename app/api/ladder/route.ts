import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const entries = await prisma.ladderEntry.findMany({
      where: { weekId: 'all-time' },
      orderBy: { bestScore: 'desc' },
      take: 10,
    });

    // Récupérer les avatars des users correspondants
    const pseudos = entries.map(e => e.pseudo);
    const users = await prisma.user.findMany({
      where: { OR: [
        { username: { in: pseudos } },
        { displayName: { in: pseudos } },
      ]},
      select: { username: true, displayName: true, avatarFile: true },
    });

    return NextResponse.json({
      entries: entries.map((entry, index) => {
        const user = users.find(u => (u.displayName || u.username) === entry.pseudo || u.username === entry.pseudo);
        return {
          rank: index + 1,
          pseudo: entry.pseudo,
          bestScore: entry.bestScore,
          gamesPlayed: entry.gamesPlayed,
          avatarFile: user?.avatarFile ?? null,
          username: user?.username ?? null,
        };
      }),
    });
  } catch (error) {
    console.error('Erreur lecture ladder:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
