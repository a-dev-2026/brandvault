import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, json, withErrorHandling } from '@/lib/api';
import { createSessionToken, setAuthCookie } from '@/server/auth';

export const POST = withErrorHandling(async (_req: NextRequest) => {
  const email = process.env.DEMO_EMAIL!.trim().toLowerCase();

  const user = await db.user.findUnique({
    where: { email },
    include: {
      workspaces: {
        take: 1,
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!user || user.workspaces.length === 0) {
    throw ApiError.notFound('Demo user or workspace not found. Please run database seed.');
  }

  const workspaceId = user.workspaces[0]!.id;

  const token = await createSessionToken({
    userId: user.id,
    workspaceId,
    email: user.email,
  });

  await setAuthCookie(token);

  return json(
    {
      id: user.id,
      email: user.email,
      workspaceId,
    },
    200
  );
});
