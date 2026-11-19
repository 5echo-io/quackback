/**
 * Zod Schemas for Help Center Operations
 *
 * Shared validation schemas used by both client and server.
 */

import { z } from 'zod'
import { tiptapContentSchema } from './posts'
import { SUPPORTED_LOCALES } from '@/lib/shared/i18n'

/** A help-center content language: one of the portal's locale ids. */
export const helpCenterLocaleSchema = z.enum(SUPPORTED_LOCALES)

/** A category's name and description in each language other than the default. */
export const categoryTranslationsSchema = z.partialRecord(
  helpCenterLocaleSchema,
  z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).nullable().optional(),
  })
)

/** Shared by an article and its translations. */
export const translationGroupSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9._-]*$/, 'Lowercase letters, digits, dots, dashes and underscores')

// ============================================================================
// Category Schemas
// ============================================================================

export const listCategoriesSchema = z.object({
  showDeleted: z.boolean().optional(),
})

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  slug: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  isPublic: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
  parentId: z.string().nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  translations: categoryTranslationsSchema.optional(),
})

export const updateCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  slug: z.string().max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  isPublic: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
  parentId: z.string().nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  translations: categoryTranslationsSchema.optional(),
})

export const getCategorySchema = z.object({
  id: z.string().min(1),
})

export const deleteCategorySchema = z.object({
  id: z.string().min(1),
})

// ============================================================================
// Article Schemas
// ============================================================================

export const createArticleSchema = z.object({
  categoryId: z.string().min(1),
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required'),
  contentJson: tiptapContentSchema.nullable().optional(),
  slug: z.string().max(200).optional(),
  position: z.number().int().optional(),
  description: z.string().max(300).optional(),
  locale: helpCenterLocaleSchema.optional(),
  translationGroup: translationGroupSchema.nullable().optional(),
})

export const updateArticleSchema = z.object({
  id: z.string().min(1),
  categoryId: z.string().optional(),
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  contentJson: tiptapContentSchema.nullable().optional(),
  slug: z.string().max(200).optional(),
  position: z.number().int().optional(),
  description: z.string().max(300).optional(),
  locale: helpCenterLocaleSchema.optional(),
  translationGroup: translationGroupSchema.nullable().optional(),
})

export const getArticleSchema = z.object({
  id: z.string().min(1),
})

export const deleteArticleSchema = z.object({
  id: z.string().min(1),
})

export const listArticlesSchema = z.object({
  categoryId: z.string().optional(),
  status: z.enum(['draft', 'published', 'all']).optional(),
  search: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().positive().max(100).optional(),
  showDeleted: z.boolean().optional(),
  sort: z.enum(['newest', 'oldest']).optional(),
  locale: helpCenterLocaleSchema.optional(),
})

export const listPublicArticlesSchema = z.object({
  categoryId: z.string().optional(),
  search: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().positive().max(100).optional(),
})

export const publishArticleSchema = z.object({
  id: z.string().min(1),
})

export const articleFeedbackSchema = z.object({
  articleId: z.string().min(1),
  helpful: z.boolean(),
})

export const getCategoryBySlugSchema = z.object({
  slug: z.string().min(1),
})

export const getArticleBySlugSchema = z.object({
  slug: z.string().min(1),
})

export const unpublishArticleSchema = z.object({
  id: z.string().min(1),
})

export const restoreCategorySchema = z.object({
  id: z.string().min(1),
})

export const restoreArticleSchema = z.object({
  id: z.string().min(1),
})

// ============================================================================
// Help Center Config Schemas
// ============================================================================

export const updateHelpCenterConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    homepageTitle: z.string().min(1).max(200).optional(),
    homepageDescription: z.string().max(500).optional(),
    locales: z.array(helpCenterLocaleSchema).min(1).optional(),
    defaultLocale: helpCenterLocaleSchema.optional(),
  })
  .refine(
    (data) => !data.locales || !data.defaultLocale || data.locales.includes(data.defaultLocale),
    { message: 'The default language must be one of the languages', path: ['defaultLocale'] }
  )

export const updateHelpCenterSeoSchema = z.object({
  metaDescription: z.string().max(500).optional(),
  sitemapEnabled: z.boolean().optional(),
  structuredDataEnabled: z.boolean().optional(),
})

// ============================================================================
// Inferred Types
// ============================================================================

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = Omit<z.infer<typeof updateCategorySchema>, 'id'>
export type UpdateCategoryPayload = z.infer<typeof updateCategorySchema>
export type CreateArticleInput = z.infer<typeof createArticleSchema>
export type UpdateArticleInput = Omit<z.infer<typeof updateArticleSchema>, 'id'>
export type UpdateArticlePayload = z.infer<typeof updateArticleSchema>
export type ListArticlesParams = z.infer<typeof listArticlesSchema>
