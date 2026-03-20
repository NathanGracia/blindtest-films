import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PUT /api/admin/achievements/[code]/emote — lie une emote à un succès (ou délie)
export async function PUT(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const { emoteId } = await req.json(); // null pour délier

    // Délier toute emote précédemment liée à ce succès
    await prisma.emote.updateMany({
      where: { achievementCode: code },
      data: { achievementCode: null },
    });

    // Lier la nouvelle emote si fournie
    if (emoteId) {
      await prisma.emote.update({
        where: { id: emoteId },
        data: { achievementCode: code },
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
