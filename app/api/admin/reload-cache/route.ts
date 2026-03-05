import { NextRequest, NextResponse } from 'next/server';

/**
 * Endpoint pour recharger le cache des tracks côté serveur (Socket.IO).
 * Utile après avoir ajouté de nouvelles tracks sans redémarrer le serveur.
 */
export async function POST(req: NextRequest) {
  try {
    // Appeler l'endpoint interne du serveur Socket.IO pour recharger le cache
    const serverUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';
    const response = await fetch(`${serverUrl}/internal/reload-cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to reload cache on server');
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: 'Cache rechargé avec succès',
      tracksCount: data.tracksCount,
    });
  } catch (error) {
    console.error('Error reloading cache:', error);
    return NextResponse.json(
      { error: 'Erreur lors du rechargement du cache' },
      { status: 500 }
    );
  }
}
