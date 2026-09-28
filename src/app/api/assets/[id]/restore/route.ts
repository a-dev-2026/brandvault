import { NextRequest } from 'next/server';
import { json, RouteContext, withErrorHandling } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { restoreAsset } from '@/server/assets.service';
import { sendWebhookEvent } from '@/server/webhook';

export const POST = withErrorHandling(async (req: NextRequest, context: RouteContext) => {
  const session = await requireUser(req);
  const { id } = await context.params;
  const asset = await restoreAsset(session.workspaceId, id as string);

  sendWebhookEvent({
    event: 'asset_restored',
    resourceId: asset.id,
    userEmail: session.email,
    timestamp: new Date().toISOString(),
    data: { name: asset.name, type: asset.type },
  });

  return json(asset, 200);
});
