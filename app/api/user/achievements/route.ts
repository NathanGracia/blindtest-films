import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyUserToken } from '@/lib/userAuth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('blindtoss_user_session');
  const userId = session ? verifyUserToken(session.value) : null;
  if (!userId) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });

  const achievements = await prisma.userAchievement.findMany({
    where: { userId },
    orderBy: { unlockedAt: 'asc' },
  });

  return NextResponse.json(achievements);
}
