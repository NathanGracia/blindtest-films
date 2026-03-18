import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { isAdmin } = await request.json();

  if (typeof isAdmin !== 'boolean') {
    return NextResponse.json({ error: 'isAdmin doit être un booléen' }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: parseInt(id, 10) },
    data: { isAdmin },
    select: { id: true, username: true, displayName: true, isAdmin: true },
  });

  return NextResponse.json(user);
}
