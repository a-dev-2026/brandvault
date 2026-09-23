import { z } from 'zod';

export const aiSuggestionSchema = z.object({
  tags: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .min(1, 'Tag must be at least 1 character')
        .max(30, 'Tag must be at most 30 characters')
    )
    .min(3, 'At least 3 tags are required')
    .max(8, 'At most 8 tags are allowed')
    .transform((tags) => Array.from(new Set(tags))),
  description: z.string().trim().max(200, 'Description must be at most 200 characters'),
  usage_suggestion: z.string().trim().max(200, 'Usage suggestion must be at most 200 characters'),
});

export type AiSuggestion = z.infer<typeof aiSuggestionSchema>;

export const saveAiTagsSchema = z.object({
  tags: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .min(1, 'Tag must be at least 1 character')
        .max(30, 'Tag must be at most 30 characters')
    )
    .min(1, 'At least 1 tag is required')
    .max(15, 'At most 15 tags are allowed')
    .transform((tags) => Array.from(new Set(tags))),
  description: z.string().trim().max(200, 'Description must be at most 200 characters').nullable().optional(),
  usage_suggestion: z
    .string()
    .trim()
    .max(200, 'Usage suggestion must be at most 200 characters')
    .nullable()
    .optional(),
});

export type SaveAiTagsInput = z.infer<typeof saveAiTagsSchema>;
