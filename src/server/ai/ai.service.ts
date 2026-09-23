import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/api';
import { generateJson } from './provider';
import { aiSuggestionSchema, SaveAiTagsInput } from './schema';
import { scopedAssetWhere } from '../assets.service';

const PROMPT_PATH = path.join(process.cwd(), 'prompts', 'asset-tagging.md');

// In-memory per-user rate limiter (10 requests per minute per user)
const userRateLimits = new Map<string, { count: number; resetAt: number }>();

/**
 * Enforces per-user rate limiting for AI generation (10 requests / 60 seconds).
 * Automatically resets expired user windows.
 */
export function enforceAiRateLimit(userId: string, maxRequests = 10, windowMs = 60000): void {
  const now = Date.now();
  const record = userRateLimits.get(userId);

  if (!record || now > record.resetAt) {
    userRateLimits.set(userId, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (record.count >= maxRequests) {
    throw new ApiError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'AI tagging rate limit exceeded. Please wait a minute before trying again.'
    );
  }

  record.count++;
}

export async function generateAssetTags(workspaceId: string, userId: string, assetId: string) {
  // 1. Enforce rate limit
  enforceAiRateLimit(userId);

  // 2. Fetch asset owned by workspace
  const where = scopedAssetWhere(workspaceId, { id: assetId });
  const asset = await db.asset.findFirst({
    where,
    include: {
      folder: { select: { name: true } },
    },
  });

  if (!asset) {
    throw ApiError.notFound('Asset not found');
  }

  if (asset.deletedAt !== null) {
    throw ApiError.conflict('Cannot generate AI tags for a trashed asset');
  }

  // 3. Fetch brand for colors and guidelines
  const brand = await db.brand.findFirst({
    where: { workspaceId },
  });

  const folderName = asset.folder ? asset.folder.name : 'Root';
  const brandName = brand ? brand.name : 'Unspecified Brand';
  const brandColors = [brand?.primaryColor, brand?.secondaryColor].filter(Boolean);

  // 4. Load system prompt file
  let systemPrompt: string;
  try {
    systemPrompt = fs.readFileSync(PROMPT_PATH, 'utf-8');
  } catch (err) {
    console.error('[AI Service Error]: Failed to read prompts/asset-tagging.md', err);
    throw ApiError.internal('Prompt configuration file is missing');
  }

  const userPrompt = JSON.stringify({
    asset_name: asset.name,
    asset_type: asset.type,
    url: asset.url,
    folder_name: folderName,
    brand_name: brandName,
    brand_colors: brandColors.length > 0 ? brandColors : ['#000000'],
  });

  // 5. Call provider with ONCE retry on Zod / JSON parse error
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const jsonText = await generateJson(systemPrompt, userPrompt);
      const parsed = JSON.parse(jsonText);
      const validationResult = aiSuggestionSchema.safeParse(parsed);

      if (validationResult.success) {
        return validationResult.data;
      }
      lastError = validationResult.error;
    } catch (err) {
      if (err instanceof ApiError && err.code === 'BAD_GATEWAY') {
        throw new ApiError(502, 'AI_UNAVAILABLE', 'AI service is temporarily unavailable');
      }
      lastError = err;
    }
  }

  console.error('[AI Service Error]: Validation failed after retry attempt:', lastError);
  throw new ApiError(502, 'AI_INVALID_RESPONSE', 'AI provider returned an invalid metadata format');
}

export async function saveAssetAiTags(
  workspaceId: string,
  assetId: string,
  input: SaveAiTagsInput
) {
  const where = scopedAssetWhere(workspaceId, { id: assetId });
  const asset = await db.asset.findFirst({ where });

  if (!asset) {
    throw ApiError.notFound('Asset not found');
  }

  if (asset.deletedAt !== null) {
    throw ApiError.conflict('Cannot save AI tags on a trashed asset');
  }

  return db.asset.update({
    where: { id: assetId },
    data: {
      aiTags: input.tags,
      ...(input.description !== undefined && { description: input.description }),
      ...(input.usage_suggestion !== undefined && { usageSuggestion: input.usage_suggestion }),
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
