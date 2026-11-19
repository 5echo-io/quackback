/**
 * Types for Help Center domain
 */

import type { TiptapContent } from '@/lib/server/db'
import type { HelpCenterCategoryId, HelpCenterArticleId, PrincipalId } from '@quackback/ids'

// Re-export input types from shared schemas (single source of truth)
export type {
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateArticleInput,
  UpdateArticleInput,
  ListArticlesParams,
} from '@/lib/shared/schemas/help-center'

// ============================================================================
// Category Types
// ============================================================================

export interface HelpCenterCategory {
  id: HelpCenterCategoryId
  parentId: HelpCenterCategoryId | null
  slug: string
  name: string
  description: string | null
  icon: string | null
  isPublic: boolean
  position: number
  /** Name and description per language other than the default. */
  translations: Record<string, { name: string; description?: string | null }>
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date | null
}

export interface HelpCenterCategoryWithCount extends HelpCenterCategory {
  /** Total non-deleted articles in this category (drafts + published). */
  articleCount: number
  /** Published articles in this category (excludes drafts and scheduled). */
  publishedArticleCount: number
  /** articleCount plus the same for every descendant in the tree. */
  recursiveArticleCount: number
  /** publishedArticleCount plus the same for every descendant in the tree. */
  recursivePublishedArticleCount: number
}

// ============================================================================
// Article Types
// ============================================================================

export interface HelpCenterArticle {
  id: HelpCenterArticleId
  categoryId: HelpCenterCategoryId
  slug: string
  /** The language the article is written in. */
  locale: string
  /** Shared with the article's translations; null when it has none. */
  translationGroup: string | null
  title: string
  description: string | null
  position: number | null
  content: string
  contentJson: TiptapContent | null
  principalId: PrincipalId
  publishedAt: Date | null
  viewCount: number
  helpfulCount: number
  notHelpfulCount: number
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date | null
}

export interface HelpCenterArticleWithCategory extends HelpCenterArticle {
  category: {
    id: HelpCenterCategoryId
    slug: string
    name: string
  }
  author: {
    id: PrincipalId
    name: string
    avatarUrl: string | null
  } | null
}

// ============================================================================
// List/Search Types
// ============================================================================

/** A published translation of an article, for the language switcher. */
export interface ArticleTranslation {
  locale: string
  slug: string
  title: string
  categorySlug: string
}

export interface ArticleListResult {
  items: HelpCenterArticleWithCategory[]
  nextCursor: string | null
  hasMore: boolean
}
