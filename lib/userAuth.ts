import { cookies } from 'next/headers';
import crypto from 'crypto';
import { prisma } from './prisma';

const SESSION_COOKIE = 'blindtoss_user_session';

function getSecret(): string {
  return process.env.ADMIN_PASSWORD || 'blindtoss-user-secret';
}

// ── Token de session ──────────────────────────────────────────────

export function signUserToken(userId: number): string {
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const payload = `${userId}:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  return `${payload}:${hmac}`;
}

export function verifyUserToken(token: string): number | null {
  try {
    const parts = token.split(':');
    if (parts.length !== 3) return null;
    const [userIdStr, expiresAtStr, hmac] = parts;
    const userId = parseInt(userIdStr, 10);
    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(userId) || isNaN(expiresAt)) return null;
    if (Date.now() > expiresAt) return null;
    const expected = crypto
      .createHmac('sha256', getSecret())
      .update(`${userId}:${expiresAt}`)
      .digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) return null;
    return userId;
  } catch {
    return null;
  }
}

// ── Hachage mot de passe (Node crypto / scrypt) ───────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await new Promise<string>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) reject(err);
      else resolve(key.toString('hex'));
    });
  });
  return `${salt}:${hash}`;
}

export async function comparePassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), derivedKey);
}

// ── Session (lecture seule — écriture via response.cookies) ───────

export async function getCurrentUser(): Promise<{ id: number; username: string } | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (!session?.value) return null;

  const userId = verifyUserToken(session.value);
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true },
  });
}
