import { z } from 'zod';
import { AssetType, Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/api';

const httpsUrlSchema = z
  .string()
  .url('Must be a valid URL')
  .refine((val) => val.startsWith('https://'), 'URL must start with https://');

export const createAssetSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name must be at most 120 characters'),
  type: z.nativeEnum(AssetType),
  url: httpsUrlSchema,
  folderId: z.string().nullable().optional(),
  size: z.number().int().nonnegative().optional().default(0),
  mimeType: z.string().optional().default('application/octet-stream'),
  tags: z.array(z.string()).optional().default([]),
  aiTags: z.array(z.string()).optional().default([]),
});

export const updateAssetSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name must be at most 120 characters').optional(),
  type: z.nativeEnum(AssetType).optional(),
  url: httpsUrlSchema.optional(),
  folderId: z.string().nullable().optional(),
  size: z.number().int().nonnegative().optional(),
  mimeType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  aiTags: z.array(z.string()).optional(),
});

export const getAssetsQuerySchema = z.object({
  folderId: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(['updated_desc', 'name_asc']).optional().default('updated_desc'),
  cursor: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 24))
    .pipe(z.number().min(1).max(100)),
  trashed: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type GetAssetsQuery = z.infer<typeof getAssetsQuerySchema>;

// Central helper ensuring every query is strictly scoped by workspaceId
export function scopedAssetWhere(
  workspaceId: string,
  extraWhere?: Prisma.AssetWhereInput
): Prisma.AssetWhereInput {
  return {
    workspaceId,
    ...extraWhere,
  };
}

export async function getAssets(workspaceId: string, query: GetAssetsQuery) {
  const { folderId, q, sort, cursor, limit, trashed } = query;

  if (trashed) {
    const where = scopedAssetWhere(workspaceId, {
      deletedAt: { not: null },
    });

    const orderBy: Prisma.AssetOrderByWithRelationInput[] = [
      { deletedAt: 'desc' },
      { id: 'desc' },
    ];

    const items = await db.asset.findMany({
      where,
      orderBy,
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      include: {
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem ? nextItem.id : null;
    }

    return {
      items,
      nextCursor,
    };
  }

  const extraWhere: Prisma.AssetWhereInput = {
    deletedAt: null,
  };

  if (q && q.trim().length > 0) {
    // Search across whole workspace by name, ignoring folderId
    extraWhere.name = {
      contains: q.trim(),
      mode: 'insensitive',
    };
  } else if (folderId) {
    if (folderId === 'root') {
      extraWhere.folderId = null;
    } else {
      const folder = await db.folder.findFirst({
        where: { id: folderId, workspaceId },
      });
      if (!folder) {
        throw ApiError.notFound('Folder not found');
      }
      extraWhere.folderId = folderId;
    }
  } else {
    extraWhere.folderId = null;
  }

  const where = scopedAssetWhere(workspaceId, extraWhere);

  let orderBy: Prisma.AssetOrderByWithRelationInput[];
  if (sort === 'name_asc') {
    orderBy = [{ name: 'asc' }, { id: 'asc' }];
  } else {
    orderBy = [{ updatedAt: 'desc' }, { id: 'desc' }];
  }

  const items = await db.asset.findMany({
    where,
    orderBy,
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    include: {
      folder: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  let nextCursor: string | null = null;
  if (items.length > limit) {
    const nextItem = items.pop();
    nextCursor = nextItem ? nextItem.id : null;
  }

  return {
    items,
    nextCursor,
  };
}

export async function getAssetById(workspaceId: string, assetId: string) {
  const where = scopedAssetWhere(workspaceId, { id: assetId });

  const asset = await db.asset.findFirst({
    where,
    include: {
      folder: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!asset) {
    throw ApiError.notFound('Asset not found');
  }

  return asset;
}

export async function createAsset(workspaceId: string, input: CreateAssetInput) {
  if (input.folderId) {
    const folder = await db.folder.findFirst({
      where: { id: input.folderId, workspaceId },
    });

    if (!folder) {
      throw ApiError.notFound('Folder not found');
    }
  }

  return db.asset.create({
    data: {
      workspaceId,
      name: input.name,
      type: input.type,
      url: input.url,
      folderId: input.folderId ?? null,
      size: input.size ?? 0,
      mimeType: input.mimeType ?? 'application/octet-stream',
      tags: input.tags ?? [],
      aiTags: input.aiTags ?? [],
    },
    include: {
      folder: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function updateAsset(workspaceId: string, assetId: string, input: UpdateAssetInput) {
  const where = scopedAssetWhere(workspaceId, { id: assetId });

  const existingAsset = await db.asset.findFirst({
    where,
  });

  if (!existingAsset) {
    throw ApiError.notFound('Asset not found');
  }

  if (existingAsset.deletedAt !== null) {
    throw ApiError.conflict('Cannot edit a trashed asset');
  }

  if (input.folderId !== undefined && input.folderId !== null) {
    const folder = await db.folder.findFirst({
      where: { id: input.folderId, workspaceId },
    });

    if (!folder) {
      throw ApiError.notFound('Folder not found');
    }
  }

  return db.asset.update({
    where: { id: assetId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.url !== undefined && { url: input.url }),
      ...(input.folderId !== undefined && { folderId: input.folderId }),
      ...(input.size !== undefined && { size: input.size }),
      ...(input.mimeType !== undefined && { mimeType: input.mimeType }),
      ...(input.tags !== undefined && { tags: input.tags }),
      ...(input.aiTags !== undefined && { aiTags: input.aiTags }),
      updatedAt: new Date(),
    },
    include: {
      folder: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function trashAsset(workspaceId: string, assetId: string) {
  const where = scopedAssetWhere(workspaceId, { id: assetId });

  const existingAsset = await db.asset.findFirst({ where });
  if (!existingAsset) {
    throw ApiError.notFound('Asset not found');
  }

  if (existingAsset.deletedAt !== null) {
    throw ApiError.conflict('Asset is already in trash');
  }

  return db.asset.update({
    where: { id: assetId },
    data: {
      deletedAt: new Date(),
    },
    include: {
      folder: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function restoreAsset(workspaceId: string, assetId: string) {
  const where = scopedAssetWhere(workspaceId, { id: assetId });

  const existingAsset = await db.asset.findFirst({ where });
  if (!existingAsset) {
    throw ApiError.notFound('Asset not found');
  }

  if (existingAsset.deletedAt === null) {
    throw ApiError.conflict('Asset is not in trash');
  }

  let folderId = existingAsset.folderId;
  if (folderId) {
    const folderExists = await db.folder.findFirst({
      where: { id: folderId, workspaceId },
    });
    if (!folderExists) {
      folderId = null; // Restores to root if original folder no longer exists
    }
  }

  return db.asset.update({
    where: { id: assetId },
    data: {
      deletedAt: null,
      folderId,
    },
    include: {
      folder: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function permanentlyDeleteAsset(workspaceId: string, assetId: string) {
  const where = scopedAssetWhere(workspaceId, { id: assetId });

  const existingAsset = await db.asset.findFirst({ where });
  if (!existingAsset) {
    throw ApiError.notFound('Asset not found');
  }

  if (existingAsset.deletedAt === null) {
    throw new ApiError(409, 'NOT_IN_TRASH', 'Asset must be trashed before permanent deletion');
  }

  await db.asset.delete({
    where: { id: assetId },
  });

  return { success: true };
}
