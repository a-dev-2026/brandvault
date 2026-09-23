import { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { ApiError, json, parseBody, withErrorHandling } from '@/lib/api';
import { createSessionToken, setAuthCookie } from '@/server/auth';

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const { email, password } = await parseBody(req, loginSchema);

  const user = await db.user.findUnique({
    where: { email },
    include: {
      workspaces: {
        take: 1,
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  let workspaceId = user.workspaces[0]?.id;
  if (!workspaceId) {
    const newWorkspace = await db.workspace.create({
      data: {
        name: `${user.email.split('@')[0]}'s Workspace`,
        userId: user.id,
      },
    });
    workspaceId = newWorkspace.id;
  }

  const token = await createSessionToken({
    userId: user.id,
    workspaceId,
    email: user.email,
  });

  await setAuthCookie(token);

  return json({ id: user.id, email: user.email }, 200);
});
