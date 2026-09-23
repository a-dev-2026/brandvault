import { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { ApiError, json, parseBody, withErrorHandling } from '@/lib/api';
import { createSessionToken, setAuthCookie } from '@/server/auth';

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const { email, password } = await parseBody(req, signupSchema);

  const existingUser = await db.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw ApiError.conflict('User with this email already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const { user, workspace } = await db.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    const newWorkspace = await tx.workspace.create({
      data: {
        name: `${email.split('@')[0]}'s Workspace`,
        userId: newUser.id,
      },
    });

    return { user: newUser, workspace: newWorkspace };
  });

  const token = await createSessionToken({
    userId: user.id,
    workspaceId: workspace.id,
    email: user.email,
  });

  await setAuthCookie(token);

  return json({ id: user.id, email: user.email }, 201);
});
