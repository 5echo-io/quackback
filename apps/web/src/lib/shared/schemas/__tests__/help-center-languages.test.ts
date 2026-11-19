import { describe, it, expect } from 'vitest'
import {
  categoryTranslationsSchema,
  createArticleSchema,
  translationGroupSchema,
  updateHelpCenterConfigSchema,
} from '../help-center'

describe('help-center language schemas', () => {
  it('takes a translation for some languages, not all', () => {
    expect(categoryTranslationsSchema.safeParse({ nb: { name: 'Kom i gang' } }).success).toBe(true)
    expect(categoryTranslationsSchema.safeParse({ xx: { name: 'Nope' } }).success).toBe(false)
    expect(categoryTranslationsSchema.safeParse({ nb: { name: '' } }).success).toBe(false)
  })

  it('keeps translation keys to a slug-like shape', () => {
    expect(translationGroupSchema.safeParse('ai-assistants.connect').success).toBe(true)
    expect(translationGroupSchema.safeParse('Getting Started').success).toBe(false)
    expect(translationGroupSchema.safeParse('').success).toBe(false)
  })

  it('accepts an article in a supported language with a translation key', () => {
    const parsed = createArticleSchema.safeParse({
      categoryId: 'category_1',
      title: 'Kom i gang',
      content: 'Hei',
      locale: 'nb',
      translationGroup: 'getting-started',
    })
    expect(parsed.success).toBe(true)
    expect(
      createArticleSchema.safeParse({ categoryId: 'c', title: 't', content: 'x', locale: 'xx' })
        .success
    ).toBe(false)
  })

  it('refuses a default language that is not one of the languages', () => {
    expect(
      updateHelpCenterConfigSchema.safeParse({ locales: ['en', 'nb'], defaultLocale: 'nb' }).success
    ).toBe(true)
    expect(
      updateHelpCenterConfigSchema.safeParse({ locales: ['en'], defaultLocale: 'nb' }).success
    ).toBe(false)
    expect(updateHelpCenterConfigSchema.safeParse({ locales: [] }).success).toBe(false)
  })
})
