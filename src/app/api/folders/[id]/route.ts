import { NextRequest } from 'next/server';
import { json, parseBody, RouteContext, withErrorHandling } from '@/lib/api';
import { requireUser } from '@/server/auth';
import {
  deleteFolder,
  getFolderById,
  updateFolder,
  updateFolderSchema,
} from '@/server/folders.service';

export const GET = withErrorHandling(async (req: NextRequest, context: RouteContext) => {
  const session = await requireUser(req);
  const { id } = await context.params;
  const folder = await getFolderById(session.workspaceId, id as string);
  return json(folder, 200);
});

export const PATCH = withErrorHandling(async (req: NextRequest, context: RouteContext) => {
  const session = await requireUser(req);
  const { id } = await context.params;
  const body = await parseBody(req, updateFolderSchema);
  const folder = await updateFolder(session.workspaceId, id as string, body);
  return json(folder, 200);
});

export const DELETE = withErrorHandling(async (req: NextRequest, context: RouteContext) => {
  const session = await requireUser(req);
  const { id } = await context.params;
  const result = await deleteFolder(session.workspaceId, id as string);
  return json(result, 200);
});
