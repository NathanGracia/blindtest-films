import { NextResponse } from 'next/server';
import { readTracks, addTrack, readCategories } from '@/lib/data';

export async function GET() {
  try {
    const tracks = await readTracks();
    return NextResponse.json(tracks);
  } catch (error) {
    console.error('Erreur lecture tracks:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, titleVF, acceptedAnswers, audioFile, imageFile, categoryId, timeLimit, startTime } = body;

    if (!title || !acceptedAnswers || !audioFile || !categoryId) {
      return NextResponse.json(
        { error: 'Titre, réponses acceptées, fichier audio et catégorie requis' },
        { status: 400 }
      );
    }

    // Vérifier que la catégorie existe
    const categories = await readCategories();
    if (!categories.find(c => c.id === categoryId)) {
      return NextResponse.json({ error: 'Catégorie non trouvée' }, { status: 400 });
    }

    // Normaliser les réponses acceptées
    const answers = Array.isArray(acceptedAnswers)
      ? acceptedAnswers
      : acceptedAnswers.split(',').map((a: string) => a.trim()).filter(Boolean);

    const track = await addTrack({
      title,
      titleVF: titleVF || null,
      acceptedAnswers: answers,
      audioFile,
      imageFile: imageFile || null,
      categoryId,
      timeLimit: timeLimit || 30,
      startTime: startTime || 0,
    });

    return NextResponse.json(track, { status: 201 });
  } catch (error) {
    console.error('Erreur création track:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
