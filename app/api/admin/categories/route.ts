import { NextResponse } from 'next/server';
import { readCategories, addCategory, countTracksByCategory } from '@/lib/data';

export async function GET() {
  try {
    const categories = await readCategories();
    const counts = await countTracksByCategory();

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, icon, color } = body;

    if (!id || !name) {
      return NextResponse.json({ error: 'ID et nom requis' }, { status: 400 });
    }

    // Valider l'ID (alphanumérique, tirets, underscores)
    if (!/^[a-z0-9_-]+$/i.test(id)) {
      return NextResponse.json({ error: 'ID invalide (alphanumérique, tirets et underscores uniquement)' }, { status: 400 });
    }

    const category = await addCategory({
      id,
      name,
      icon: icon || 'music',
      color: color || '#4a90d9',
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('existe déjà')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Erreur création catégorie:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
