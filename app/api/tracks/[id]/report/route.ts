import { NextResponse } from 'next/server';
import { reportTrack, getTrackById } from '@/lib/data';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const trackId = parseInt(id, 10);

    if (isNaN(trackId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
    }

    const track = await getTrackById(trackId);
    if (!track) {
      return NextResponse.json({ error: 'Musique introuvable' }, { status: 404 });
    }

    let message = '';
    try {
      const body = await request.json();
      message = typeof body.message === 'string' ? body.message.slice(0, 200) : '';
    } catch {
      // Pas de body JSON
    }

    const success = await reportTrack(trackId, message);
    if (!success) {
      return NextResponse.json({ error: 'Erreur lors du signalement' }, { status: 500 });
    }

    console.log(`[REPORT] Track ${trackId} "${track.title}"${message ? ` : ${message}` : ''}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur report track:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
