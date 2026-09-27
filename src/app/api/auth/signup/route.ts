import { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { ApiError, json, parseBody, withErrorHandling } from '@/lib/api';
import { createSessionToken, setAuthCookie } from '@/server/auth';

const signupSchema = z.object({
  name: z.string().trim().min(1, 'Full name is required'),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  workspaceName: z.string().trim().optional(),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const { name, email, password, workspaceName } = await parseBody(req, signupSchema);

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
        name,
      },
    });

    const newWorkspace = await tx.workspace.create({
      data: {
        name: workspaceName && workspaceName.length > 0 ? workspaceName : 'Main',
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
