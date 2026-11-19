/**
 * Where a language-switcher entry goes: the article's translation in that
 * language when the reader is on an article that has one, otherwise the page
 * they are on. Always with `?lang=`, which the server honours and remembers.
 */
export function helpCenterLanguageHref(input: {
  locale: string
  pathname: string
  translations: ReadonlyArray<{ locale: string; slug: string; categorySlug: string }>
}): string {
  const translation = input.translations.find((t) => t.locale === input.locale)
  const path = translation
    ? `/hc/articles/${translation.categorySlug}/${translation.slug}`
    : input.pathname
  return `${path}?lang=${encodeURIComponent(input.locale)}`
}
