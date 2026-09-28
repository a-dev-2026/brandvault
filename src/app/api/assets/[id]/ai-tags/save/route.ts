import { NextRequest } from 'next/server';
import { json, parseBody, RouteContext, withErrorHandling } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { saveAssetAiTags } from '@/server/ai/ai.service';
import { saveAiTagsSchema } from '@/server/ai/schema';
import { sendWebhookEvent } from '@/server/webhook';

export const PATCH = withErrorHandling(async (req: NextRequest, context: RouteContext) => {
  const session = await requireUser(req);
  const { id } = await context.params;
  const body = await parseBody(req, saveAiTagsSchema);
  const updatedAsset = await saveAssetAiTags(session.workspaceId, id as string, body);

  sendWebhookEvent({
    event: 'ai_tags_saved',
    resourceId: updatedAsset.id,
    userEmail: session.email,
    timestamp: new Date().toISOString(),
    data: { name: updatedAsset.name, tagsCount: updatedAsset.tags.length },
  });

  return json(updatedAsset, 200);
});
