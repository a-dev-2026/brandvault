import { NextRequest } from 'next/server';
import { json, withErrorHandling } from '@/lib/api';
import { requireUser } from '@/server/auth';

export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireUser(req);
  return json({ id: session.userId, email: session.email }, 200);
});
