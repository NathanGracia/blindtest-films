import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set('blindtoss_user_session', '', { httpOnly: true, path: '/', maxAge: 0 });
  response.cookies.set('blindtoss_admin_session', '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
