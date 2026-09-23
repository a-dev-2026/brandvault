import { NextRequest } from 'next/server';
import { json, RouteContext, withErrorHandling } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { trashAsset } from '@/server/assets.service';

export const POST = withErrorHandling(async (req: NextRequest, context: RouteContext) => {
  const session = await requireUser(req);
  const { id } = await context.params;
  const asset = await trashAsset(session.workspaceId, id as string);
  return json(asset, 200);
});
