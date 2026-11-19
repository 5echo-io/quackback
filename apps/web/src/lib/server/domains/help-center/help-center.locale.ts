/**
 * Language in help-center queries.
 *
 * Every published article is in one language. A reader is shown the articles
 * in their content language (contentLocaleFor) and, where an article has no
 * translation in that language, the article in the help center's default
 * language. Articles in any other language are left out.
 */
import type { SQL } from 'drizzle-orm'
import { helpCenterArticles, sql } from '@/lib/server/db'
import { SUPPORTED_LOCALES } from '@/lib/shared/i18n'
import { searchConfigForLocale } from '@/lib/shared/help-center-locale'
import { ValidationError } from '@/lib/shared/errors'

/** The language a reader reads in, and the help center's default. */
export interface ReaderLocale {
  locale: string
  defaultLocale: string
}

/**
 * The row's own text-search dictionary, as SQL. It is the CASE the search
 * vector is generated with (migration 0126), so the query always stems in the
 * article's own language, whichever language the reader searches from.
 */
export function articleSearchConfig(): SQL {
  const branches = SUPPORTED_LOCALES.filter((l) => searchConfigForLocale(l) !== 'english')
    .map((l) => `WHEN '${l}' THEN '${searchConfigForLocale(l)}'::regconfig`)
    .join(' ')
  return sql`CASE ${helpCenterArticles.locale} ${sql.raw(branches)} ELSE 'english'::regconfig END`
}

/** The article matches a free-text query, in its own language. */
export function articleMatches(search: string): SQL {
  return sql`${helpCenterArticles.searchVector} @@ websearch_to_tsquery(${articleSearchConfig()}, ${search})`
}

/**
 * The article is one this reader is shown: in their language, or in the
 * default language when no published translation in theirs exists.
 */
export function readableIn(reader: ReaderLocale): SQL {
  if (reader.locale === reader.defaultLocale) {
    return sql`${helpCenterArticles.locale} = ${reader.defaultLocale}`
  }
  return sql`(${helpCenterArticles.locale} = ${reader.locale} OR (${helpCenterArticles.locale} = ${reader.defaultLocale} AND (${helpCenterArticles.translationGroup} IS NULL OR NOT EXISTS (
    SELECT 1 FROM "kb_articles" AS "kb_translation"
    WHERE "kb_translation"."translation_group" = ${helpCenterArticles.translationGroup}
      AND "kb_translation"."locale" = ${reader.locale}
      AND "kb_translation"."deleted_at" IS NULL
      AND "kb_translation"."published_at" IS NOT NULL
      AND "kb_translation"."published_at" <= now()
  ))))`
}

/** Refuse a language the help center does not offer. */
export function assertOfferedLocale(locale: string, offered: readonly string[]): void {
  if (!offered.includes(locale)) {
    throw new ValidationError(
      'VALIDATION_ERROR',
      `The help center is not offered in "${locale}". Turn the language on in Settings → Help Center first.`
    )
  }
}

/** Postgres' unique-violation code, for the one-translation-per-language index. */
export function isTranslationConflict(error: unknown): boolean {
  const e = error as {
    code?: string
    constraint_name?: string
    cause?: { code?: string; constraint_name?: string }
  }
  const code = e?.code ?? e?.cause?.code
  const constraint = e?.constraint_name ?? e?.cause?.constraint_name
  return code === '23505' && (!constraint || constraint === 'kb_articles_translation_locale_idx')
}
