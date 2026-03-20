import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyUserToken } from '@/lib/userAuth';
import { prisma } from '@/lib/prisma';

export async function DELETE(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const cookieStore = await cookies();
  const session = cookieStore.get('blindtoss_user_session');
  const userId = session ? verifyUserToken(session.value) : null;
  if (!userId) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });

  const { code } = await params;

  await prisma.userAchievement.deleteMany({ where: { userId, code } });

  return NextResponse.json({ ok: true });
}
