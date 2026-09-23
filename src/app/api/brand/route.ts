import { NextRequest } from 'next/server';
import { json, parseBody, withErrorHandling } from '@/lib/api';
import { requireUser } from '@/server/auth';
import {
  createBrandForWorkspace,
  createBrandSchema,
  getBrandByWorkspace,
  updateBrandForWorkspace,
  updateBrandSchema,
} from '@/server/brand.service';

export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireUser(req);
  const brand = await getBrandByWorkspace(session.workspaceId);
  return json(brand, 200);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireUser(req);
  const body = await parseBody(req, createBrandSchema);
  const brand = await createBrandForWorkspace(session.workspaceId, body);
  return json(brand, 201);
});

export const PATCH = withErrorHandling(async (req: NextRequest) => {
  const session = await requireUser(req);
  const body = await parseBody(req, updateBrandSchema);
  const brand = await updateBrandForWorkspace(session.workspaceId, body);
  return json(brand, 200);
});
