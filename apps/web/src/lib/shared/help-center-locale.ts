/**
 * The languages of help-center content, and the one rule that picks which
 * article a reader is shown.
 *
 * An article is written in one language and its translations share a
 * translation group. A reader reads in their own locale (resolveVisitorLocale)
 * when the help center offers it, and otherwise in the help center's default.
 * An article with no translation in the reader's language is shown in the
 * default language rather than not at all, so turning a language on never
 * empties a category.
 */
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from './i18n'

export interface HelpCenterLocaleConfig {
  locales?: string[] | null
  defaultLocale?: string | null
}

function isSupported(locale: string | null | undefined): locale is SupportedLocale {
  return !!locale && (SUPPORTED_LOCALES as readonly string[]).includes(locale)
}

/** The help center's languages and default, whatever the stored config holds. */
export function helpCenterLocales(config: HelpCenterLocaleConfig | null | undefined): {
  locales: SupportedLocale[]
  defaultLocale: SupportedLocale
} {
  const stored = (config?.locales ?? []).filter(isSupported)
  const defaultLocale = isSupported(config?.defaultLocale)
    ? config.defaultLocale
    : (stored[0] ?? DEFAULT_LOCALE)
  const locales = stored.includes(defaultLocale) ? stored : [defaultLocale, ...stored]
  return { locales: [...new Set(locales)], defaultLocale }
}

/** The language a reader is shown content in. */
export function contentLocaleFor(
  visitorLocale: string | null | undefined,
  config: HelpCenterLocaleConfig | null | undefined
): SupportedLocale {
  const { locales, defaultLocale } = helpCenterLocales(config)
  return isSupported(visitorLocale) && locales.includes(visitorLocale)
    ? visitorLocale
    : defaultLocale
}

// Postgres text-search dictionaries. The migration that builds the search
// vector (0126) uses the same mapping in SQL; keep the two in step.
const SEARCH_CONFIG: Record<SupportedLocale, string> = {
  en: 'english',
  nb: 'norwegian',
  sv: 'swedish',
  da: 'danish',
  de: 'german',
  fr: 'french',
  es: 'spanish',
  ru: 'russian',
  'pt-br': 'portuguese',
  ar: 'arabic',
  'zh-cn': 'simple',
  'zh-tw': 'simple',
}

/** The text-search dictionary for a language: the query must stem as the index did. */
export function searchConfigForLocale(locale: string | null | undefined): string {
  return isSupported(locale) ? SEARCH_CONFIG[locale] : 'english'
}

export interface TranslatableCategory {
  name: string
  description: string | null
  translations?: Record<string, { name: string; description?: string | null }> | null
}

/** A category's name and description in a language, or its base ones. */
export function localizedCategory<T extends TranslatableCategory>(
  category: T,
  locale: string | null | undefined
): T {
  const translation = locale ? category.translations?.[locale] : undefined
  if (!translation?.name) return category
  return {
    ...category,
    name: translation.name,
    description: translation.description ?? category.description,
  }
}
