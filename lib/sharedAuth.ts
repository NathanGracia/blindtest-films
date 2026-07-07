import { cookies } from 'next/headers';
import crypto from 'crypto';
import { prisma } from './prisma';

// Vérification du cookie de session partagé émis par cooloss
// (https://cooloss.nathangracia.com) — remplace l'ancien système local
// (lib/auth.ts, lib/userAuth.ts) où Blindtoss gérait lui-même mots de passe
// et sessions. Le mot de passe/l'avatar/le flag admin vivent maintenant sur
// cooloss ; Blindtoss garde une table User locale en MIROIR uniquement pour
// que les clés étrangères (GameResult, UserAchievement, UserTrackNote)
// continuent de fonctionner (SQLite ne supporte pas les FK inter-bases).
//
// Même schéma de token que cooloss/lib/sharedToken.ts et
// media-gallery/server/shared_auth.py — si tu changes le format ici,
// réplique le changement dans les deux autres.

const SHARED_SESSION_COOKIE = 'nathangracia_session';

export interface SharedClaims {
  uid: number;
  username: string;
  displayName: string | null;
  isAdmin: boolean;
  avatarFile: string | null;
  exp: number;
}

function getSecret(): string {
  const secret = process.env.SHARED_SESSION_SECRET;
  if (!secret) throw new Error('SHARED_SESSION_SECRET manquant.');
  return secret;
}

function base64urlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function hmac(payloadB64: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');
}

function verifySharedToken(token: string | undefined): SharedClaims | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;

  let expected: string;
  try {
    expected = hmac(payloadB64, getSecret());
  } catch {
    return null;
  }

  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const claims = JSON.parse(base64urlDecode(payloadB64)) as SharedClaims;
    if (typeof claims.uid !== 'number' || typeof claims.exp !== 'number') return null;
    if (Date.now() > claims.exp) return null;
    return claims;
  } catch {
    return null;
  }
}

export async function getSharedClaims(): Promise<SharedClaims | null> {
  const cookieStore = await cookies();
  return verifySharedToken(cookieStore.get(SHARED_SESSION_COOKIE)?.value);
}

// Upsert le miroir local à partir des claims du token — garantit que la ligne
// User existe avant tout write sur une table qui la référence par FK
// (GameResult, UserAchievement, UserTrackNote), et garde username/
// displayName/avatar/isAdmin à jour localement. displayName est éditable
// uniquement sur cooloss (plus de PATCH local ici) ; passwordHash local n'est
// plus jamais lu, il ne sert qu'à satisfaire la contrainte NOT NULL du schéma.
async function mirrorUser(claims: SharedClaims) {
  return prisma.user.upsert({
    where: { id: claims.uid },
    update: { username: claims.username, displayName: claims.displayName, avatarFile: claims.avatarFile, isAdmin: claims.isAdmin },
    create: {
      id: claims.uid,
      username: claims.username,
      displayName: claims.displayName,
      avatarFile: claims.avatarFile,
      isAdmin: claims.isAdmin,
      passwordHash: '',
    },
  });
}

// Pour les routes qui n'ont besoin que de l'id (filtrer leurs propres
// requêtes) — fait quand même le mirror pour garantir la FK.
export async function getCurrentUserId(): Promise<number | null> {
  const claims = await getSharedClaims();
  if (!claims) return null;
  await mirrorUser(claims);
  return claims.uid;
}

// Pour les routes qui ont besoin du profil complet.
export async function getCurrentUser() {
  const claims = await getSharedClaims();
  if (!claims) return null;
  return mirrorUser(claims);
}
