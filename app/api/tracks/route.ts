import { NextResponse } from 'next/server';
import { readTracks, getTracksByCategories } from '@/lib/data';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoriesParam = searchParams.get('categories');

    let tracks;
    if (categoriesParam) {
      const categoryIds = categoriesParam.split(',').filter(Boolean);
      tracks = await getTracksByCategories(categoryIds);
    } else {
      tracks = await readTracks();
    }

    return NextResponse.json(tracks);
  } catch (error) {
    console.error('Erreur lecture tracks:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
