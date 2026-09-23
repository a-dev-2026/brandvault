import { NextRequest } from 'next/server';
import { json, RouteContext, withErrorHandling } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { generateAssetTags } from '@/server/ai/ai.service';

export const POST = withErrorHandling(async (req: NextRequest, context: RouteContext) => {
  const session = await requireUser(req);
  const { id } = await context.params;
  const suggestion = await generateAssetTags(session.workspaceId, session.userId, id as string);
  return json(suggestion, 200);
});
