import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyUserToken } from '@/lib/userAuth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('blindtoss_user_session');
    const userId = session ? verifyUserToken(session.value) : null;

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
