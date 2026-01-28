import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const trackId = parseInt(id, 10);

    if (isNaN(trackId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
    }

    // Récupérer le track depuis la base
    const track = await prisma.track.findUnique({
      where: { id: trackId },
      select: { audioFile: true },
    });

    if (!track || !track.audioFile) {
      return NextResponse.json({ error: 'Fichier non trouvé' }, { status: 404 });
    }

    // Construire le chemin du fichier (enlever le "/" initial si présent)
    const audioPath = track.audioFile.startsWith('/')
      ? track.audioFile.slice(1)
      : track.audioFile;

    const filePath = join(process.cwd(), 'public', audioPath);

    // Lire le fichier
    const fileBuffer = await readFile(filePath);

    // Retourner le fichier avec les bons headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error) {
    console.error('Erreur lecture fichier audio:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
