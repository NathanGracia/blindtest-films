import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyUserToken } from '@/lib/userAuth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('blindtoss_user_session');
  if (!session?.value) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });

  const userId = verifyUserToken(session.value);
  if (!userId) return NextResponse.json({ error: 'Session invalide' }, { status: 401 });

  const notes = await prisma.userTrackNote.findMany({
    where: { userId, note: { not: '' } },
    orderBy: { updatedAt: 'desc' },
    include: {
      track: {
        select: {
          id: true,
          title: true,
          titleVF: true,
          imageFile: true,
          audioFile: true,
          startTime: true,
          difficulty: true,
          categoryId: true,
        },
      },
    },
  });

  return NextResponse.json(notes);
}

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('blindtoss_user_session');
  if (!session?.value) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });

  const userId = verifyUserToken(session.value);
  if (!userId) return NextResponse.json({ error: 'Session invalide' }, { status: 401 });

  const { trackId, note } = await request.json();
  if (!trackId) return NextResponse.json({ error: 'trackId requis' }, { status: 400 });

  const trimmed = String(note || '').slice(0, 100);

  await prisma.userTrackNote.upsert({
    where: { userId_trackId: { userId, trackId } },
    update: { note: trimmed },
    create: { userId, trackId, note: trimmed },
  });

  return NextResponse.json({ ok: true });
}
