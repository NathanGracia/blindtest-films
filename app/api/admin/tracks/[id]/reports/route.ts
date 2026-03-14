import { NextResponse } from 'next/server';
import { getReportsByTrackId } from '@/lib/data';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const trackId = parseInt(id, 10);

    if (isNaN(trackId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
    }

    const reports = await getReportsByTrackId(trackId);
    return NextResponse.json(reports);
  } catch (error) {
    console.error('Erreur lecture reports:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
