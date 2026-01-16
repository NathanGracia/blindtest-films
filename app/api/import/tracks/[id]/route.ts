import { NextRequest, NextResponse } from 'next/server';
import { deleteTrack } from '@/lib/data';

// Token d'authentification pour les imports (depuis .env)
const IMPORT_API_TOKEN = process.env.IMPORT_API_TOKEN || process.env.ADMIN_PASSWORD;

function verifyToken(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  return token === IMPORT_API_TOKEN;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Vérifier le token d'authentification
    if (!verifyToken(request)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id, 10);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
    }

    await deleteTrack(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erreur suppression track:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}
