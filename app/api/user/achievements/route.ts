import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/sharedAuth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });

  const achievements = await prisma.userAchievement.findMany({
    where: { userId },
    orderBy: { unlockedAt: 'asc' },
  });

  return NextResponse.json(achievements);
}
