import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyUserToken } from '@/lib/userAuth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('blindtoss_user_session');
  if (!session?.value) return NextResponse.json({ user: null });

  const userId = verifyUserToken(session.value);
  if (!userId) return NextResponse.json({ user: null });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, displayName: true, avatarFile: true, isAdmin: true },
  });

  return NextResponse.json({ user });
}
