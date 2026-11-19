import { describe, it, expect } from 'vitest'
import { helpCenterLanguageHref } from '../help-center-language-href'

describe('helpCenterLanguageHref', () => {
  const translations = [
    { locale: 'en', slug: 'getting-started', categorySlug: 'basics' },
    { locale: 'nb', slug: 'kom-i-gang', categorySlug: 'basics' },
  ]

  it('goes to the translation in that language', () => {
    expect(
      helpCenterLanguageHref({
        locale: 'nb',
        pathname: '/hc/articles/basics/getting-started',
        translations,
      })
    ).toBe('/hc/articles/basics/kom-i-gang?lang=nb')
  })

  it('stays on the page when there is no translation', () => {
    expect(
      helpCenterLanguageHref({
        locale: 'sv',
        pathname: '/hc/articles/basics/getting-started',
        translations,
      })
    ).toBe('/hc/articles/basics/getting-started?lang=sv')
    expect(helpCenterLanguageHref({ locale: 'da', pathname: '/hc', translations: [] })).toBe(
      '/hc?lang=da'
    )
  })
})
