import { NextRequest } from 'next/server';
import { json, parseBody, RouteContext, withErrorHandling } from '@/lib/api';
import { requireUser } from '@/server/auth';
import {
  getAssetById,
  permanentlyDeleteAsset,
  updateAsset,
  updateAssetSchema,
} from '@/server/assets.service';

export const GET = withErrorHandling(async (req: NextRequest, context: RouteContext) => {
  const session = await requireUser(req);
  const { id } = await context.params;
  const asset = await getAssetById(session.workspaceId, id as string);
  return json(asset, 200);
});

export const PATCH = withErrorHandling(async (req: NextRequest, context: RouteContext) => {
  const session = await requireUser(req);
  const { id } = await context.params;
  const body = await parseBody(req, updateAssetSchema);
  const asset = await updateAsset(session.workspaceId, id as string, body);
  return json(asset, 200);
});

export const DELETE = withErrorHandling(async (req: NextRequest, context: RouteContext) => {
  const session = await requireUser(req);
  const { id } = await context.params;
  const result = await permanentlyDeleteAsset(session.workspaceId, id as string);
  return json(result, 200);
});
