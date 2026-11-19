import { useIntl } from 'react-intl'
import { useMatches } from '@tanstack/react-router'
import { LanguageIcon, CheckIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LOCALE_AUTONYMS, type SupportedLocale } from '@/lib/shared/i18n'
import { helpCenterLanguageHref } from './help-center-language-href'

interface ArticleTranslation {
  locale: string
  slug: string
  categorySlug: string
}

interface HelpCenterLanguageSwitcherProps {
  /** The help center's languages. Nothing renders for one. */
  locales: string[]
  /** The language the reader reads in now (an article page shows its own). */
  current: string
}

/**
 * The help center's languages, each by its own name. Every entry is a plain
 * link carrying `?lang=`: the server renders the next page in that language
 * and remembers the choice, so it works before (and without) hydration.
 *
 * On an article page an entry goes to that article's translation when there
 * is one, and to the same page otherwise.
 */
export function HelpCenterLanguageSwitcher({ locales, current }: HelpCenterLanguageSwitcherProps) {
  const intl = useIntl()
  const matches = useMatches()
  if (locales.length < 2) return null

  const articleMatch = matches.find(
    (m) => (m.routeId as string) === '/_portal/hc/articles/$categorySlug/$articleSlug'
  )
  const article = (
    articleMatch?.loaderData as
      | { article?: { locale?: string; translations?: ArticleTranslation[] } }
      | undefined
  )?.article
  const translations = article?.translations ?? []
  // On an article the page is in the article's language, whatever the
  // reader's: that is the one to tick.
  const shown = article?.locale ?? current
  const pathname = matches[matches.length - 1]?.pathname ?? '/hc'
  const label = intl.formatMessage({ id: 'portal.hc.language.label', defaultMessage: 'Language' })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          aria-label={label}
        >
          <LanguageIcon className="size-4" aria-hidden />
          <span>{LOCALE_AUTONYMS[shown as SupportedLocale] ?? shown}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {locales.map((locale) => (
          <DropdownMenuItem key={locale} asChild>
            <a
              href={helpCenterLanguageHref({ locale, pathname, translations })}
              hrefLang={locale}
              lang={locale}
              aria-current={locale === shown ? 'true' : undefined}
              className="flex items-center justify-between gap-6"
            >
              <span>{LOCALE_AUTONYMS[locale as SupportedLocale] ?? locale}</span>
              {locale === shown && <CheckIcon className="size-4" aria-hidden />}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
