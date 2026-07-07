import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  // N'importe quel sous-domaine de .nathangracia.com peut effacer ce cookie
  // localement (sans passer par cooloss), à condition d'utiliser EXACTEMENT
  // le même Domain+Path que celui posé au login — sinon le navigateur crée
  // un cookie host-only à côté au lieu de supprimer le vrai.
  response.cookies.set('nathangracia_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: '.nathangracia.com',
    path: '/',
    maxAge: 0,
  });
  return response;
}
