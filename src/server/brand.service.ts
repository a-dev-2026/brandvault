import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/api';

const hexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, 'Color must be a valid 6-character hex code (e.g. #FF0000)')
  .transform((val) => val.toUpperCase());

const httpsUrlSchema = z
  .union([
    z.string().url('Must be a valid URL').refine((url) => url.startsWith('https://'), 'URL must start with https://'),
    z.literal(''),
    z.null(),
  ])
  .optional()
  .transform((val) => (val === '' ? null : val));

export const createBrandSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name must be at most 80 characters'),
  primaryColor: hexColorSchema,
  secondaryColor: hexColorSchema.nullable().optional(),
  logoUrl: httpsUrlSchema,
  defaultFont: z.string().trim().max(60, 'Font name must be at most 60 characters').nullable().optional(),
  tagline: z.string().trim().nullable().optional(),
  guidelines: z.string().trim().nullable().optional(),
});

export const updateBrandSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name must be at most 80 characters').optional(),
  primaryColor: hexColorSchema.optional(),
  secondaryColor: hexColorSchema.nullable().optional(),
  logoUrl: httpsUrlSchema,
  defaultFont: z.string().trim().max(60, 'Font name must be at most 60 characters').nullable().optional(),
  tagline: z.string().trim().nullable().optional(),
  guidelines: z.string().trim().nullable().optional(),
});

export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;

export async function getBrandByWorkspace(workspaceId: string) {
  const brand = await db.brand.findFirst({
    where: { workspaceId },
  });

  if (!brand) {
    throw new ApiError(404, 'BRAND_NOT_FOUND', 'Brand not found');
  }

  return brand;
}

export async function createBrandForWorkspace(workspaceId: string, input: CreateBrandInput) {
  const existing = await db.brand.findFirst({
    where: { workspaceId },
  });

  if (existing) {
    throw ApiError.conflict('Brand already exists for this workspace');
  }

  return db.brand.create({
    data: {
      workspaceId,
      name: input.name,
      primaryColor: input.primaryColor,
      secondaryColor: input.secondaryColor ?? null,
      logoUrl: input.logoUrl ?? null,
      defaultFont: input.defaultFont ?? null,
      tagline: input.tagline ?? null,
      guidelines: input.guidelines ?? null,
    },
  });
}

export async function updateBrandForWorkspace(workspaceId: string, input: UpdateBrandInput) {
  const existing = await db.brand.findFirst({
    where: { workspaceId },
  });

  if (!existing) {
    throw new ApiError(404, 'BRAND_NOT_FOUND', 'Brand not found');
  }

  return db.brand.update({
    where: { id: existing.id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.primaryColor !== undefined && { primaryColor: input.primaryColor }),
      ...(input.secondaryColor !== undefined && { secondaryColor: input.secondaryColor }),
      ...(input.logoUrl !== undefined && { logoUrl: input.logoUrl }),
      ...(input.defaultFont !== undefined && { defaultFont: input.defaultFont }),
      ...(input.tagline !== undefined && { tagline: input.tagline }),
      ...(input.guidelines !== undefined && { guidelines: input.guidelines }),
    },
  });
}
