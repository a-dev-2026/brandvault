import { NextRequest } from 'next/server';
import { json, withErrorHandling } from '@/lib/api';
import { clearAuthCookie } from '@/server/auth';

export const POST = withErrorHandling(async (_req: NextRequest) => {
  await clearAuthCookie();
  return json({ success: true }, 200);
});
