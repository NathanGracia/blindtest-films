import { NextRequest, NextResponse } from 'next/server';
import { addTrack, readTracks } from '@/lib/data';

// Token d'authentification pour les imports (depuis .env)
const IMPORT_API_TOKEN = process.env.IMPORT_API_TOKEN || process.env.ADMIN_PASSWORD;

function verifyToken(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  return token === IMPORT_API_TOKEN;
}

export async function GET(request: NextRequest) {
  try {
    // Vérifier le token d'authentification
    if (!verifyToken(request)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Retourner tous les tracks
    const tracks = await readTracks();
    return NextResponse.json(tracks);
  } catch (error: any) {
    console.error('Erreur lecture tracks:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Vérifier le token d'authentification
    if (!verifyToken(request)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();

    // Valider les champs requis
    const { title, acceptedAnswers, audioFile, categoryId } = body;

    if (!title || !acceptedAnswers || !audioFile || !categoryId) {
      return NextResponse.json(
        { error: 'Champs manquants: title, acceptedAnswers, audioFile, categoryId requis' },
        { status: 400 }
      );
    }

    // Normaliser acceptedAnswers en tableau
    let answersArray: string[];
    if (typeof acceptedAnswers === 'string') {
      answersArray = acceptedAnswers.split(',').map((a: string) => a.trim());
    } else if (Array.isArray(acceptedAnswers)) {
      answersArray = acceptedAnswers;
    } else {
      return NextResponse.json(
        { error: 'acceptedAnswers doit être un tableau ou une chaîne séparée par des virgules' },
        { status: 400 }
      );
    }

    // Créer le track
    const track = await addTrack({
      title,
      titleVF: body.titleVF || null,
      acceptedAnswers: answersArray,
      audioFile,
      imageFile: body.imageFile || null,
      categoryId,
      timeLimit: body.timeLimit || 30,
      startTime: body.startTime || 0,
    });

    return NextResponse.json(track, { status: 201 });
  } catch (error: any) {
    console.error('Erreur création track:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}
