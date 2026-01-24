import { NextResponse } from 'next/server';
import { readTracks, getTracksByCategories, getTracksWithDistribution } from '@/lib/data';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoriesParam = searchParams.get('categories');
    const limitParam = searchParams.get('limit');

    let tracks;
    if (categoriesParam) {
      const categoryIds = categoriesParam.split(',').filter(Boolean);

      if (limitParam) {
        const limit = parseInt(limitParam, 10);
        if (!isNaN(limit) && limit > 0) {
          tracks = await getTracksWithDistribution(categoryIds, limit);
        } else {
          tracks = await getTracksByCategories(categoryIds);
        }
      } else {
        tracks = await getTracksByCategories(categoryIds);
      }
    } else {
      tracks = await readTracks();
    }

    return NextResponse.json(tracks);
  } catch (error) {
    console.error('Erreur lecture tracks:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
