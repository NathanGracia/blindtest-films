import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/sharedAuth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });

  const history = await prisma.gameResult.findMany({
    where: { userId: user.id },
    orderBy: { playedAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({ history });
}
