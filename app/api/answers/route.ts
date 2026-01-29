import { NextResponse } from 'next/server';
import { getTracksByCategories } from '@/lib/data';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoriesParam = searchParams.get('categories');
    const categoryIds = categoriesParam?.split(',').filter(Boolean) || [];

    const tracks = await getTracksByCategories(categoryIds);

    // Transformer les tracks en format pour l'autocomplétion
    const tracksData = tracks.map(track => ({
      title: track.title,
      titleVF: track.titleVF || null,
      acceptedAnswers: track.acceptedAnswers,
      categoryId: track.categoryId
    }));

    return NextResponse.json(tracksData);
  } catch (error) {
    console.error('Erreur lors de la récupération des réponses:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
