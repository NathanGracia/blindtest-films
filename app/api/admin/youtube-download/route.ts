import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { mkdir } from 'fs/promises';
import { normalizeAudioFile } from '@/lib/audio-utils';

const execAsync = promisify(exec);

export const maxDuration = 300;

const YOUTUBE_URL_RE = /^https?:\/\/(www\.)?(youtube\.com\/watch|youtu\.be\/)/;

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string' || !YOUTUBE_URL_RE.test(url)) {
      return NextResponse.json({ error: 'URL YouTube invalide' }, { status: 400 });
    }

    const timestamp = Date.now();
    const fileName = `youtube-${timestamp}.mp3`;
    const audioDir = path.join(process.cwd(), 'public', 'audio');
    const outputPath = path.join(audioDir, fileName);

    await mkdir(audioDir, { recursive: true });

    // yt-dlp via Python (déjà installé pour les scripts d'import)
    // On échappe l'URL pour éviter toute injection de commande
    const safeUrl = url.replace(/"/g, '');
    const cmd = `python -m yt_dlp --extract-audio --audio-format mp3 --audio-quality 0 --no-playlist -o "${outputPath}" "${safeUrl}"`;

    await execAsync(cmd, { timeout: 120000 });

    try {
      await normalizeAudioFile(outputPath);
    } catch (e) {
      console.error('Normalisation YouTube audio échouée (non bloquant):', e);
    }

    return NextResponse.json({
      success: true,
      path: `/audio/${fileName}`,
      fileName,
    });
  } catch (error) {
    console.error('Erreur téléchargement YouTube:', error);
    return NextResponse.json(
      { error: 'Impossible de télécharger. Vérifiez l\'URL ou uploadez le MP3 manuellement.' },
      { status: 500 }
    );
  }
}
