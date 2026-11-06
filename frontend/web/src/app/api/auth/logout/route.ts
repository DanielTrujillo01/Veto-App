import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ cerrada: true });
  response.cookies.set('veto_session', '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}
