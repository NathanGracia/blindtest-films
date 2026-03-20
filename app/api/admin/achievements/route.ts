import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const [counts, totalUsers] = await Promise.all([
      prisma.userAchievement.groupBy({
        by: ['code'],
        _count: { code: true },
      }),
      prisma.user.count(),
    ]);

    const stats = Object.fromEntries(
      counts.map(c => [c.code, { count: c._count.code, pct: totalUsers > 0 ? Math.round((c._count.code / totalUsers) * 100) : 0 }])
    );

    return NextResponse.json({ stats, totalUsers });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
