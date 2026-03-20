import { NextResponse } from 'next/server';
import { readCategories, countTracksByCategory } from '@/lib/data';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const categories = await readCategories();
    const counts = await countTracksByCategory();

    // Récupérer une image vedette (random easy, ou random si pas d'easy) par catégorie
    const featuredImages: Record<string, string | null> = {};
    await Promise.all(
      categories.map(async (cat) => {
        const easyTracks = await prisma.track.findMany({
          where: { categoryId: cat.id, difficulty: 'easy', imageFile: { not: null } },
          select: { imageFile: true },
        });
        if (easyTracks.length > 0) {
          featuredImages[cat.id] = easyTracks[Math.floor(Math.random() * easyTracks.length)].imageFile;
        } else {
          const anyTrack = await prisma.track.findFirst({
            where: { categoryId: cat.id, imageFile: { not: null } },
            select: { imageFile: true },
          });
          featuredImages[cat.id] = anyTrack?.imageFile ?? null;
        }
      })
    );

    const categoriesWithCounts = categories.map((category) => ({
      ...category,
      trackCount: counts[category.id] || 0,
      featuredImage: featuredImages[category.id] ?? null,
    }));

    return NextResponse.json(categoriesWithCounts);
  } catch (error) {
    console.error('Erreur lecture catégories:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
