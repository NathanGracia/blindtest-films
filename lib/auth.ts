import { cookies } from 'next/headers';
import crypto from 'crypto';

const SESSION_COOKIE = 'blindtest_admin_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 heures

// Génère un hash du token de session
function generateSessionToken(password: string): string {
  const secret = process.env.ADMIN_PASSWORD || '';
  return crypto
    .createHash('sha256')
    .update(password + secret + 'blindtest-salt')
    .digest('hex');
}

// Vérifie si l'utilisateur est authentifié
export async function verifyAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);

  if (!session?.value) return false;

  try {
    const [token, expiresAt] = session.value.split(':');
    const expiration = parseInt(expiresAt, 10);

    // Vérifier l'expiration
    if (Date.now() > expiration) return false;

    // Vérifier le token
    const expectedToken = generateSessionToken(process.env.ADMIN_PASSWORD || '');
    return token === expectedToken;
  } catch {
    return false;
  }
}

// Crée une session admin
export async function createSession(password: string): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || password !== adminPassword) {
    return false;
  }

  const cookieStore = await cookies();
  const token = generateSessionToken(password);
  const expiresAt = Date.now() + SESSION_DURATION;

  cookieStore.set(SESSION_COOKIE, `${token}:${expiresAt}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION / 1000,
  });

  return true;
}

// Supprime la session admin
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
