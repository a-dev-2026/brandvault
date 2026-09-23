import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { ApiError } from '@/lib/api';

const AUTH_COOKIE_NAME = 'auth_token';

const getSecretKey = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET environment variable is missing.');
  }
  return new TextEncoder().encode(secret);
};

export interface AuthSession {
  userId: string;
  workspaceId: string;
  email: string;
}

export async function createSessionToken(session: AuthSession): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<AuthSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.userId === 'string' &&
      typeof payload.workspaceId === 'string' &&
      typeof payload.email === 'string'
    ) {
      return {
        userId: payload.userId,
        workspaceId: payload.workspaceId,
        email: payload.email,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export async function requireUser(req?: NextRequest): Promise<AuthSession> {
  let token: string | undefined;

  if (req) {
    token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  }

  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    } catch {
      // Ignore when invoked outside Next.js server request store scope (e.g. unit tests)
    }
  }

  if (!token) {
    throw ApiError.unauthorized('Authentication required');
  }

  const session = await verifySessionToken(token);
  if (!session) {
    throw ApiError.unauthorized('Invalid or expired authentication token');
  }

  return session;
}
