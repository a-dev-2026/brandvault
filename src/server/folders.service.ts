import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/api';

export const createFolderSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60, 'Name must be at most 60 characters'),
  parentId: z.string().nullable().optional(),
});

export const updateFolderSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60, 'Name must be at most 60 characters').optional(),
  parentId: z.string().nullable().optional(),
});

export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;

// Helper: Calculate folder depth (Root = 1, Child of root = 2, etc.)
export async function getFolderDepth(folderId: string, workspaceId: string): Promise<number> {
  let depth = 0;
  let currentId: string | null = folderId;

  while (currentId) {
    depth++;
    if (depth > 10) break; // Safety threshold against infinite loops

    const node: { parentId: string | null } | null = await db.folder.findFirst({
      where: { id: currentId, workspaceId },
      select: { parentId: true },
    });

    if (!node) break;
    currentId = node.parentId;
  }

  return depth;
}

// Helper: Calculate max height of folder's subtree (0 if no children)
export async function getSubtreeHeight(folderId: string, workspaceId: string): Promise<number> {
  const children = await db.folder.findMany({
    where: { parentId: folderId, workspaceId },
    select: { id: true },
  });

  if (children.length === 0) return 0;

  let maxChildHeight = 0;
  for (const child of children) {
    const height = await getSubtreeHeight(child.id, workspaceId);
    if (height > maxChildHeight) {
      maxChildHeight = height;
    }
  }

  return 1 + maxChildHeight;
}

// Helper: Check if targetId is folderId or a descendant of folderId
export async function isDescendant(
  targetId: string,
  folderId: string,
  workspaceId: string
): Promise<boolean> {
  let currentId: string | null = targetId;

  while (currentId) {
    if (currentId === folderId) return true;

    const node: { parentId: string | null } | null = await db.folder.findFirst({
      where: { id: currentId, workspaceId },
      select: { parentId: true },
    });

    if (!node) break;
    currentId = node.parentId;
  }

  return false;
}

// Helper: Build ancestor breadcrumbs [{ id, name }] from root to target folder
export async function getBreadcrumbs(
  folderId: string,
  workspaceId: string
): Promise<Array<{ id: string; name: string }>> {
  const path: Array<{ id: string; name: string }> = [];
  let currentId: string | null = folderId;

  while (currentId) {
    const node: { id: string; name: string; parentId: string | null } | null =
      await db.folder.findFirst({
        where: { id: currentId, workspaceId },
        select: { id: true, name: true, parentId: true },
      });

    if (!node) break;
    path.unshift({ id: node.id, name: node.name });
    currentId = node.parentId;
  }

  return path;
}

export async function listFolders(workspaceId: string, parentIdParam?: string | null) {
  let targetParentId: string | null = null;

  if (parentIdParam && parentIdParam !== 'root') {
    targetParentId = parentIdParam;

    // Verify parent exists and belongs to the workspace
    const parentFolder = await db.folder.findFirst({
      where: { id: targetParentId, workspaceId },
    });

    if (!parentFolder) {
      throw ApiError.notFound('Parent folder not found');
    }
  }

  const folders = await db.folder.findMany({
    where: {
      workspaceId,
      parentId: targetParentId,
    },
    orderBy: {
      name: 'asc',
    },
  });

  return folders;
}

export async function getFolderById(workspaceId: string, folderId: string) {
  const folder = await db.folder.findFirst({
    where: { id: folderId, workspaceId },
  });

  if (!folder) {
    throw ApiError.notFound('Folder not found');
  }

  const breadcrumbs = await getBreadcrumbs(folderId, workspaceId);

  return {
    ...folder,
    breadcrumbs,
  };
}

export async function createFolder(workspaceId: string, input: CreateFolderInput) {
  let parentId: string | null = null;
  let parentDepth = 0;

  if (input.parentId) {
    const parentFolder = await db.folder.findFirst({
      where: { id: input.parentId, workspaceId },
    });

    if (!parentFolder) {
      throw ApiError.notFound('Parent folder not found');
    }

    parentId = parentFolder.id;
    parentDepth = await getFolderDepth(parentId, workspaceId);
  }

  // Enforce max depth 3
  if (parentDepth + 1 > 3) {
    throw new ApiError(400, 'MAX_DEPTH', 'Folder depth cannot exceed 3 levels');
  }

  // Block duplicate sibling names
  const duplicate = await db.folder.findFirst({
    where: {
      workspaceId,
      parentId,
      name: {
        equals: input.name,
        mode: 'insensitive',
      },
    },
  });

  if (duplicate) {
    throw ApiError.conflict('A folder with this name already exists in this directory');
  }

  return db.folder.create({
    data: {
      workspaceId,
      name: input.name,
      parentId,
    },
  });
}

export async function updateFolder(
  workspaceId: string,
  folderId: string,
  input: UpdateFolderInput
) {
  const existingFolder = await db.folder.findFirst({
    where: { id: folderId, workspaceId },
  });

  if (!existingFolder) {
    throw ApiError.notFound('Folder not found');
  }

  let newParentId = existingFolder.parentId;

  if (input.parentId !== undefined) {
    if (input.parentId === null) {
      newParentId = null;
    } else {
      const targetParent = await db.folder.findFirst({
        where: { id: input.parentId, workspaceId },
      });

      if (!targetParent) {
        throw ApiError.notFound('Parent folder not found');
      }

      // Prevent moving folder into itself or its own descendants
      const isLoop = await isDescendant(targetParent.id, folderId, workspaceId);
      if (isLoop) {
        throw ApiError.badRequest('Cannot move a folder into itself or its own descendants');
      }

      newParentId = targetParent.id;
    }
  }

  // Check depth limits if parentId is updated
  if (input.parentId !== undefined) {
    const targetParentDepth = newParentId ? await getFolderDepth(newParentId, workspaceId) : 0;
    const subtreeHeight = await getSubtreeHeight(folderId, workspaceId);

    if (targetParentDepth + 1 + subtreeHeight > 3) {
      throw new ApiError(400, 'MAX_DEPTH', 'Moving this folder would exceed the maximum depth limit of 3');
    }
  }

  const newName = input.name !== undefined ? input.name : existingFolder.name;

  // Check duplicate sibling names
  if (input.name !== undefined || input.parentId !== undefined) {
    const duplicate = await db.folder.findFirst({
      where: {
        workspaceId,
        parentId: newParentId,
        name: {
          equals: newName,
          mode: 'insensitive',
        },
        id: {
          not: folderId,
        },
      },
    });

    if (duplicate) {
      throw ApiError.conflict('A folder with this name already exists in this directory');
    }
  }

  return db.folder.update({
    where: { id: folderId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.parentId !== undefined && { parentId: newParentId }),
    },
  });
}

export async function deleteFolder(workspaceId: string, folderId: string) {
  const folder = await db.folder.findFirst({
    where: { id: folderId, workspaceId },
  });

  if (!folder) {
    throw ApiError.notFound('Folder not found');
  }

  // Block deletion if folder has subfolders
  const childCount = await db.folder.count({
    where: { parentId: folderId, workspaceId },
  });

  if (childCount > 0) {
    throw new ApiError(
      409,
      'FOLDER_NOT_EMPTY',
      'Cannot delete folder because it contains subfolders'
    );
  }

  // Block deletion if folder has assets (including trashed)
  const assetCount = await db.asset.count({
    where: { folderId, workspaceId },
  });

  if (assetCount > 0) {
    throw new ApiError(
      409,
      'FOLDER_NOT_EMPTY',
      'Cannot delete folder because it contains assets'
    );
  }

  await db.folder.delete({
    where: { id: folderId },
  });

  return { success: true };
}
