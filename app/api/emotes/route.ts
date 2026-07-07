import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/sharedAuth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    let unlockedCodes: string[] = [];
    if (userId) {
      const achievements = await prisma.userAchievement.findMany({
        where: { userId },
        select: { code: true },
      });
      unlockedCodes = achievements.map(a => a.code);
    }

    const emotes = await prisma.emote.findMany({
      where: {
        OR: [
          { achievementCode: null },
          { achievementCode: { in: unlockedCodes } },
        ],
      },
      orderBy: { code: 'asc' },
    });

    return NextResponse.json(emotes);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
