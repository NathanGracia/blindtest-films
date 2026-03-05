import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const token = fs.readFileSync(path.join(process.cwd(), 'token.txt'), 'utf8').trim();
    const res = await fetch(
      `https://determinoss.nathangracia.com/seed?token=${encodeURIComponent(token)}`,
      { cache: 'no-store' }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch determinoss' }, { status: 500 });
  }
}
