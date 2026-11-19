import { describe, it, expect } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import {
  articleMatches,
  articleSearchConfig,
  isTranslationConflict,
  readableIn,
} from '../help-center.locale'

const dialect = new PgDialect()
const render = (q: Parameters<PgDialect['sqlToQuery']>[0]) => dialect.sqlToQuery(q)

describe('help-center locale SQL', () => {
  it('stems each article with its own language’s dictionary', () => {
    const { sql } = render(articleSearchConfig())
    expect(sql).toContain(`"kb_articles"."locale"`)
    expect(sql).toContain(`WHEN 'nb' THEN 'norwegian'::regconfig`)
    expect(sql).toContain(`ELSE 'english'::regconfig`)
    expect(render(articleMatches('faktura')).params).toContain('faktura')
  })

  it('reads only the default language when that is the reader’s', () => {
    const { sql, params } = render(readableIn({ locale: 'en', defaultLocale: 'en' }))
    expect(sql).not.toContain('NOT EXISTS')
    expect(params).toEqual(['en'])
  })

  it('reads the reader’s language, and the default where theirs has no translation', () => {
    const { sql, params } = render(readableIn({ locale: 'nb', defaultLocale: 'en' }))
    expect(sql).toContain('NOT EXISTS')
    expect(sql).toContain(`"kb_translation"."locale" = $`)
    expect(params).toEqual(['nb', 'en', 'nb'])
  })

  it('recognises the one-translation-per-language violation', () => {
    expect(
      isTranslationConflict({
        code: '23505',
        constraint_name: 'kb_articles_translation_locale_idx',
      })
    ).toBe(true)
    expect(isTranslationConflict({ cause: { code: '23505' } })).toBe(true)
    expect(isTranslationConflict({ code: '23505', constraint_name: 'kb_articles_slug_idx' })).toBe(
      false
    )
    expect(isTranslationConflict(new Error('boom'))).toBe(false)
  })
})
