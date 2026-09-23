import { NextRequest } from 'next/server';
import { json, parseBody, parseQuery, withErrorHandling } from '@/lib/api';
import { requireUser } from '@/server/auth';
import {
  createAsset,
  createAssetSchema,
  getAssets,
  getAssetsQuerySchema,
} from '@/server/assets.service';

export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireUser(req);
  const query = parseQuery(req, getAssetsQuerySchema);
  const result = await getAssets(session.workspaceId, query);
  return json(result, 200);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireUser(req);
  const body = await parseBody(req, createAssetSchema);
  const asset = await createAsset(session.workspaceId, body);
  return json(asset, 201);
});
