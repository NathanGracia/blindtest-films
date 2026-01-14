import { NextResponse } from 'next/server';
import { readCategories, countTracksByCategory } from '@/lib/data';

export async function GET() {
  try {
    const categories = await readCategories();
    const counts = await countTracksByCategory();

    // Ajouter le compteur de tracks à chaque catégorie
    const categoriesWithCounts = categories.map((category) => ({
      ...category,
      trackCount: counts[category.id] || 0,
    }));

    return NextResponse.json(categoriesWithCounts);
  } catch (error) {
    console.error('Erreur lecture catégories:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
