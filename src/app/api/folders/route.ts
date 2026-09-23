import { NextRequest } from 'next/server';
import { z } from 'zod';
import { json, parseBody, parseQuery, withErrorHandling } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { createFolder, createFolderSchema, listFolders } from '@/server/folders.service';

const getFoldersQuerySchema = z.object({
  parentId: z.string().optional(),
});

export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireUser(req);
  const query = parseQuery(req, getFoldersQuerySchema);
  const folders = await listFolders(session.workspaceId, query.parentId);
  return json(folders, 200);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireUser(req);
  const body = await parseBody(req, createFolderSchema);
  const folder = await createFolder(session.workspaceId, body);
  return json(folder, 201);
});
