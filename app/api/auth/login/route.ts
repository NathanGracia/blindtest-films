import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ error: 'Mot de passe requis' }, { status: 400 });
    }

    const success = await createSession(password);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 });
    }
  } catch (error) {
    console.error('Erreur login:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
