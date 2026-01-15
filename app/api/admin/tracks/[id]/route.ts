import { NextResponse } from 'next/server';
import { getTrackById, updateTrack, deleteTrack, readCategories } from '@/lib/data';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const track = await getTrackById(parseInt(id, 10));

    if (!track) {
      return NextResponse.json({ error: 'Musique non trouvée' }, { status: 404 });
    }

    return NextResponse.json(track);
  } catch (error) {
    console.error('Erreur lecture track:', error);
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
    const { title, titleVF, acceptedAnswers, audioFile, imageFile, categoryId, timeLimit, startTime } = body;

    // Vérifier que la catégorie existe si elle est fournie
    if (categoryId) {
      const categories = await readCategories();
      if (!categories.find(c => c.id === categoryId)) {
        return NextResponse.json({ error: 'Catégorie non trouvée' }, { status: 400 });
      }
    }

    // Normaliser les réponses acceptées si fournies
    let answers = acceptedAnswers;
    if (acceptedAnswers && !Array.isArray(acceptedAnswers)) {
      answers = acceptedAnswers.split(',').map((a: string) => a.trim()).filter(Boolean);
    }

    const updated = await updateTrack(parseInt(id, 10), {
      title,
      titleVF,
      acceptedAnswers: answers,
      audioFile,
      imageFile,
      categoryId,
      timeLimit,
      startTime,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Musique non trouvée' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Erreur mise à jour track:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await deleteTrack(parseInt(id, 10));

    if (!deleted) {
      return NextResponse.json({ error: 'Musique non trouvée' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur suppression track:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
