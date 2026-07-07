import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/sharedAuth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });

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
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });

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
