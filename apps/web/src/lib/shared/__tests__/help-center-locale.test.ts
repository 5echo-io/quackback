import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  contentLocaleFor,
  helpCenterLocales,
  localizedCategory,
  searchConfigForLocale,
} from '../help-center-locale'
import { SUPPORTED_LOCALES } from '../i18n'

describe('helpCenterLocales', () => {
  it('is English alone for a help center that never chose', () => {
    expect(helpCenterLocales(undefined)).toEqual({ locales: ['en'], defaultLocale: 'en' })
    expect(helpCenterLocales({})).toEqual({ locales: ['en'], defaultLocale: 'en' })
  })

  it('always includes the default, once', () => {
    expect(helpCenterLocales({ locales: ['nb', 'sv'], defaultLocale: 'en' })).toEqual({
      locales: ['en', 'nb', 'sv'],
      defaultLocale: 'en',
    })
    expect(helpCenterLocales({ locales: ['en', 'nb', 'en'], defaultLocale: 'nb' })).toEqual({
      locales: ['en', 'nb'],
      defaultLocale: 'nb',
    })
  })

  it('drops languages the portal cannot speak', () => {
    expect(helpCenterLocales({ locales: ['en', 'xx'], defaultLocale: 'xx' })).toEqual({
      locales: ['en'],
      defaultLocale: 'en',
    })
  })
})

describe('contentLocaleFor', () => {
  const config = { locales: ['en', 'nb', 'sv', 'da'], defaultLocale: 'en' }

  it('reads in the visitor’s language when the help center offers it', () => {
    expect(contentLocaleFor('nb', config)).toBe('nb')
    expect(contentLocaleFor('da', config)).toBe('da')
  })

  it('falls back to the default for a language it does not offer', () => {
    expect(contentLocaleFor('de', config)).toBe('en')
    expect(contentLocaleFor(null, config)).toBe('en')
  })

  it('is the default when only one language is on', () => {
    expect(contentLocaleFor('nb', { locales: ['en'], defaultLocale: 'en' })).toBe('en')
  })
})

describe('searchConfigForLocale', () => {
  it('stems the Nordic languages with their own dictionaries', () => {
    expect(searchConfigForLocale('nb')).toBe('norwegian')
    expect(searchConfigForLocale('sv')).toBe('swedish')
    expect(searchConfigForLocale('da')).toBe('danish')
  })

  it('is English for anything it does not know', () => {
    expect(searchConfigForLocale('xx')).toBe('english')
    expect(searchConfigForLocale(undefined)).toBe('english')
  })

  // The search vector is generated in SQL (migration 0126) and queried with
  // this mapping; if the two drift, an article stems one way and its query
  // another and search quietly finds nothing.
  it('matches the dictionaries migration 0126 builds the search vector with', () => {
    const path = fileURLToPath(
      new URL(
        '../../../../../../packages/db/drizzle/0126_help_center_languages.sql',
        import.meta.url
      )
    )
    const sql = readFileSync(path, 'utf8')
    const branches = new Map(
      [...sql.matchAll(/WHEN '([^']+)' THEN '([^']+)'::regconfig/g)].map((m) => [m[1], m[2]])
    )
    for (const locale of SUPPORTED_LOCALES) {
      expect(branches.get(locale) ?? 'english', locale).toBe(searchConfigForLocale(locale))
    }
  })
})

describe('localizedCategory', () => {
  const category = {
    name: 'Getting started',
    description: 'First steps',
    translations: { nb: { name: 'Kom i gang', description: null } },
  }

  it('names a category in the reader’s language', () => {
    expect(localizedCategory(category, 'nb')).toMatchObject({
      name: 'Kom i gang',
      description: 'First steps',
    })
  })

  it('keeps the base name where there is no translation', () => {
    expect(localizedCategory(category, 'sv').name).toBe('Getting started')
    expect(localizedCategory(category, undefined).name).toBe('Getting started')
  })
})
