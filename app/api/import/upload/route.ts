import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { normalizeAudioFile } from '@/lib/audio-utils';

const IMPORT_API_TOKEN = process.env.IMPORT_API_TOKEN || process.env.ADMIN_PASSWORD;
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export const maxDuration = 300;

function verifyToken(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  return authHeader?.replace('Bearer ', '') === IMPORT_API_TOKEN;
}

export async function POST(request: NextRequest) {
  if (!verifyToken(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }
    if (!type || !['audio', 'image'].includes(type)) {
      return NextResponse.json({ error: 'Type invalide (audio ou image)' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 100MB)' }, { status: 400 });
    }

    const allowedTypes = type === 'audio' ? ALLOWED_AUDIO_TYPES : ALLOWED_IMAGE_TYPES;
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Type non autorisé. Acceptés: ${allowedTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Conserver le nom slug tel quel (déterministe, pas de timestamp)
    const ext = path.extname(file.name);
    const baseName = path.basename(file.name, ext)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-');
    const fileName = `${baseName}${ext}`;
    const folder = type === 'audio' ? 'audio' : 'images';
    const relativePath = `/${folder}/${fileName}`;
    const absolutePath = path.join(process.cwd(), 'public', folder, fileName);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

    if (type === 'audio') {
      try {
        await normalizeAudioFile(absolutePath);
      } catch (error) {
        console.error('Normalisation audio échouée:', error);
      }
    }

    return NextResponse.json({ success: true, path: relativePath });
  } catch (error) {
    console.error('Erreur upload import:', error);
    return NextResponse.json({ error: 'Erreur serveur lors de l\'upload' }, { status: 500 });
  }
}
