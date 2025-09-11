import { NextRequest } from 'next/server';
import { verifyToken } from './jwt';
import { prisma } from '@/lib/prisma';

export interface Session {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

export async function validateSession(req: NextRequest): Promise<Session | null> {
  try {
    const token = extractTokenFromRequest(req);
    if (!token) return null;

    const payload = verifyToken(token);
    if (!payload) return null;

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) return null;

    return { user };
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}

function extractTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  const cookie = req.cookies.get('auth-token');
  return cookie?.value || null;
}