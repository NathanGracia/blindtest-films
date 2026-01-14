import { NextResponse } from 'next/server';
import { getCategoryById, updateCategory, deleteCategory, getTracksByCategory } from '@/lib/data';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const category = await getCategoryById(id);

    if (!category) {
      return NextResponse.json({ error: 'Catégorie non trouvée' }, { status: 404 });
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error('Erreur lecture catégorie:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, icon, color } = body;

    const updated = await updateCategory(id, { name, icon, color });

    if (!updated) {
      return NextResponse.json({ error: 'Catégorie non trouvée' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Erreur mise à jour catégorie:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Vérifier s'il y a des tracks dans cette catégorie
    const tracks = await getTracksByCategory(id);
    if (tracks.length > 0) {
      return NextResponse.json(
        { error: `Impossible de supprimer : ${tracks.length} musique(s) utilisent cette catégorie` },
        { status: 400 }
      );
    }

    const deleted = await deleteCategory(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Catégorie non trouvée' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur suppression catégorie:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
