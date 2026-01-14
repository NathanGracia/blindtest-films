import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';

export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur logout:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
