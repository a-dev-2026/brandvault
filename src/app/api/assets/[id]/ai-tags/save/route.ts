import { NextRequest } from 'next/server';
import { json, parseBody, RouteContext, withErrorHandling } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { saveAssetAiTags } from '@/server/ai/ai.service';
import { saveAiTagsSchema } from '@/server/ai/schema';

export const PATCH = withErrorHandling(async (req: NextRequest, context: RouteContext) => {
  const session = await requireUser(req);
  const { id } = await context.params;
  const body = await parseBody(req, saveAiTagsSchema);
  const updatedAsset = await saveAssetAiTags(session.workspaceId, id as string, body);
  return json(updatedAsset, 200);
});
