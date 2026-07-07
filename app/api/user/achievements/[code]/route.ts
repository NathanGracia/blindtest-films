import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/sharedAuth';
import { prisma } from '@/lib/prisma';

export async function DELETE(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });

  const { code } = await params;

  await prisma.userAchievement.deleteMany({ where: { userId, code } });

  return NextResponse.json({ ok: true });
}
