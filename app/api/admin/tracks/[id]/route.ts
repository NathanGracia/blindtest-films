import { NextResponse } from 'next/server';
import { getTrackById, updateTrack, deleteTrack, readCategories, resetReportCount } from '@/lib/data';
import { prisma } from '@/lib/prisma';

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Reset report count si demandé
    if (body.action === 'reset-reports') {
      const success = await resetReportCount(parseInt(id, 10));

      if (!success) {
        return NextResponse.json({ error: 'Musique non trouvée' }, { status: 404 });
      }

      return NextResponse.json({ success: true, reportCount: 0 });
    }

    // Définir la difficulté
    if (body.action === 'set-difficulty') {
      const { difficulty } = body;
      const updated = await prisma.track.update({
        where: { id: parseInt(id, 10) },
        data: { difficulty },
      });
      return NextResponse.json({ success: true, difficulty: updated.difficulty });
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });
  } catch (error) {
    console.error('Erreur PATCH track:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
