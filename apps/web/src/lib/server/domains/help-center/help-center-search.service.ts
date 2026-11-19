/**
 * Help Center Hybrid Search Service
 *
 * Combines tsvector keyword search with pgvector semantic search
 * for improved article discovery. Falls back to keyword-only search
 * when embedding generation is unavailable.
 */

import {
  db,
  helpCenterArticles,
  helpCenterCategories,
  and,
  eq,
  isNull,
  isNotNull,
  lte,
  sql,
} from '@/lib/server/db'
import { generateKbEmbedding } from './help-center-embedding.service'
import { articleSearchConfig, readableIn, type ReaderLocale } from './help-center.locale'
import { localizedCategory } from '@/lib/shared/help-center-locale'

const KEYWORD_WEIGHT = 0.4
const SEMANTIC_WEIGHT = 0.6

export interface HybridSearchResult {
  id: string
  slug: string
  title: string
  description: string | null
  content: string
  categoryId: string
  categorySlug: string
  categoryName: string
  /** The language the article is written in. */
  locale: string
  score: number
}

/**
 * Combine keyword and semantic search scores.
 *
 * When both scores are available, applies weighted combination (0.4 keyword + 0.6 semantic).
 * When only one score is available, returns that score directly.
 * Returns 0 when both are null.
 */
export function computeHybridScore(
  keywordScore: number | null,
  semanticScore: number | null
): number {
  if (keywordScore != null && semanticScore != null) {
    return KEYWORD_WEIGHT * keywordScore + SEMANTIC_WEIGHT * semanticScore
  }
  if (keywordScore != null) return keywordScore
  if (semanticScore != null) return semanticScore
  return 0
}

/**
 * Execute hybrid search combining keyword and semantic matching.
 *
 * 1. Generates a query embedding via Gemini (may return null if AI is unavailable)
 * 2. If embedding is available: runs a hybrid query combining tsvector + pgvector
 * 3. If embedding is unavailable: falls back to keyword-only search
 */
export async function hybridSearch(
  query: string,
  limit = 10,
  /** Search only what this reader is shown: their language, or the default's. */
  reader?: ReaderLocale
): Promise<HybridSearchResult[]> {
  const queryEmbedding = await generateKbEmbedding(query)

  if (queryEmbedding) {
    return hybridQuery(query, queryEmbedding, limit, reader)
  }

  return keywordOnlyQuery(query, limit, reader)
}

/** The category's name in the reader's language. */
function categoryNameFor(
  row: { categoryName: string; categoryTranslations: Record<string, { name: string }> | null },
  reader?: ReaderLocale
): string {
  return localizedCategory(
    { name: row.categoryName, description: null, translations: row.categoryTranslations },
    reader?.locale
  ).name
}

/**
 * Hybrid query: combines tsvector keyword search with pgvector semantic similarity.
 */
async function hybridQuery(
  query: string,
  embedding: number[],
  limit: number,
  reader?: ReaderLocale
): Promise<HybridSearchResult[]> {
  const vectorStr = `[${embedding.join(',')}]`
  // Each article stems in its own language (help-center.locale).
  const tsQuery = sql`websearch_to_tsquery(${articleSearchConfig()}, ${query})`

  const results = await db
    .select({
      id: helpCenterArticles.id,
      slug: helpCenterArticles.slug,
      title: helpCenterArticles.title,
      description: helpCenterArticles.description,
      content: helpCenterArticles.content,
      categoryId: helpCenterArticles.categoryId,
      categorySlug: helpCenterCategories.slug,
      categoryName: helpCenterCategories.name,
      categoryTranslations: helpCenterCategories.translations,
      locale: helpCenterArticles.locale,
      combinedScore: sql<number>`(
        ${KEYWORD_WEIGHT} * COALESCE(ts_rank(${helpCenterArticles.searchVector}, ${tsQuery}), 0) +
        ${SEMANTIC_WEIGHT} * COALESCE(1 - (${helpCenterArticles.embedding} <=> ${vectorStr}::vector), 0)
      )`.as('combined_score'),
    })
    .from(helpCenterArticles)
    .innerJoin(
      helpCenterCategories,
      sql`${helpCenterArticles.categoryId} = ${helpCenterCategories.id}`
    )
    .where(
      and(
        isNotNull(helpCenterArticles.publishedAt),
        // Hide scheduled-future publish dates and articles under
        // categories the admin marked private. Single-article lookup
        // (getPublicArticleBySlug) already does this; search must
        // match or the slug becomes discoverable via search even when
        // direct lookup denies.
        lte(helpCenterArticles.publishedAt, new Date()),
        isNull(helpCenterArticles.deletedAt),
        isNull(helpCenterCategories.deletedAt),
        eq(helpCenterCategories.isPublic, true),
        ...(reader ? [readableIn(reader)] : []),
        sql`(
          ${helpCenterArticles.searchVector} @@ ${tsQuery}
          OR (
            ${helpCenterArticles.embedding} IS NOT NULL
            AND 1 - (${helpCenterArticles.embedding} <=> ${vectorStr}::vector) > 0.5
          )
        )`
      )
    )
    .orderBy(sql`combined_score DESC`)
    .limit(limit)

  return results.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    content: r.content,
    categoryId: r.categoryId,
    categorySlug: r.categorySlug,
    categoryName: categoryNameFor(r, reader),
    locale: r.locale,
    score: Number(r.combinedScore),
  }))
}

/**
 * Keyword-only fallback when embedding generation is unavailable.
 */
async function keywordOnlyQuery(
  query: string,
  limit: number,
  reader?: ReaderLocale
): Promise<HybridSearchResult[]> {
  const tsQuery = sql`websearch_to_tsquery(${articleSearchConfig()}, ${query})`

  const results = await db
    .select({
      id: helpCenterArticles.id,
      slug: helpCenterArticles.slug,
      title: helpCenterArticles.title,
      description: helpCenterArticles.description,
      content: helpCenterArticles.content,
      categoryId: helpCenterArticles.categoryId,
      categorySlug: helpCenterCategories.slug,
      categoryName: helpCenterCategories.name,
      categoryTranslations: helpCenterCategories.translations,
      locale: helpCenterArticles.locale,
      score: sql<number>`ts_rank(${helpCenterArticles.searchVector}, ${tsQuery})`.as('score'),
    })
    .from(helpCenterArticles)
    .innerJoin(
      helpCenterCategories,
      sql`${helpCenterArticles.categoryId} = ${helpCenterCategories.id}`
    )
    .where(
      and(
        isNotNull(helpCenterArticles.publishedAt),
        lte(helpCenterArticles.publishedAt, new Date()),
        isNull(helpCenterArticles.deletedAt),
        isNull(helpCenterCategories.deletedAt),
        eq(helpCenterCategories.isPublic, true),
        ...(reader ? [readableIn(reader)] : []),
        sql`${helpCenterArticles.searchVector} @@ ${tsQuery}`
      )
    )
    .orderBy(sql`score DESC`)
    .limit(limit)

  return results.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    content: r.content,
    categoryId: r.categoryId,
    categorySlug: r.categorySlug,
    categoryName: categoryNameFor(r, reader),
    locale: r.locale,
    score: Number(r.score),
  }))
}
