import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function generateFileName(originalName: string): string {
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
  const timestamp = Date.now();
  return `${baseName}-${timestamp}${ext}`;
}

export async function POST(request: Request) {
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

    // Vérifier la taille
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 50MB)' }, { status: 400 });
    }

    // Vérifier le type MIME
    const allowedTypes = type === 'audio' ? ALLOWED_AUDIO_TYPES : ALLOWED_IMAGE_TYPES;
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Type de fichier non autorisé. Types acceptés: ${allowedTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Générer le nom de fichier
    const fileName = generateFileName(file.name);
    const folder = type === 'audio' ? 'audio' : 'images';
    const relativePath = `/${folder}/${fileName}`;
    const absolutePath = path.join(process.cwd(), 'public', folder, fileName);

    // Créer le dossier si nécessaire
    await mkdir(path.dirname(absolutePath), { recursive: true });

    // Écrire le fichier
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(absolutePath, buffer);

    return NextResponse.json({
      success: true,
      path: relativePath,
      fileName,
    });
  } catch (error) {
    console.error('Erreur upload:', error);
    return NextResponse.json({ error: 'Erreur serveur lors de l\'upload' }, { status: 500 });
  }
}
