// Vérification du cookie de session partagé, utilisable dans le runtime Edge
// de middleware.ts — Prisma/le module `crypto` de Node n'y tournent pas, donc
// cette version utilise Web Crypto (`crypto.subtle`, disponible globalement
// dans les deux runtimes) plutôt que lib/sharedAuth.ts (Node, utilisé par les
// route handlers). Vérifie seulement la signature + expiration, ne touche
// jamais la DB — contrairement à lib/sharedAuth.ts qui fait aussi le miroir
// local, ce qui nécessite Prisma et ne peut pas tourner ici.

export interface SharedClaimsEdge {
  uid: number;
  username: string;
  displayName: string | null;
  isAdmin: boolean;
  avatarFile: string | null;
  exp: number;
}

function base64urlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (input.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  return bytes;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifySharedTokenEdge(token: string | undefined): Promise<SharedClaimsEdge | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, signatureHex] = parts;

  const secret = process.env.SHARED_SESSION_SECRET;
  if (!secret) return null;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  const expected = new Uint8Array(signatureBuffer);
  const actual = hexToBytes(signatureHex);

  if (!constantTimeEqual(expected, actual)) return null;

  try {
    const json = new TextDecoder().decode(base64urlToBytes(payloadB64));
    const claims = JSON.parse(json) as SharedClaimsEdge;
    if (typeof claims.uid !== 'number' || typeof claims.exp !== 'number') return null;
    if (Date.now() > claims.exp) return null;
    return claims;
  } catch {
    return null;
  }
}
