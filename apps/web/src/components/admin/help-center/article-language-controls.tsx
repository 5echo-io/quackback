import { useQuery } from '@tanstack/react-query'
import { LanguageIcon } from '@heroicons/react/24/outline'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { settingsQueries } from '@/lib/client/queries/settings'
import { LOCALE_AUTONYMS, type SupportedLocale } from '@/lib/shared/i18n'
import { helpCenterLocales } from '@/lib/shared/help-center-locale'
import type { HelpCenterConfig } from '@/lib/shared/types/settings'

interface ArticleLanguageControlsProps {
  locale: string
  onLocaleChange: (locale: string) => void
  translationGroup: string
  onTranslationGroupChange: (group: string) => void
}

/**
 * An article's language and its translation key. Hidden while the help
 * center has a single language: every article is then in that one.
 */
export function ArticleLanguageControls({
  locale,
  onLocaleChange,
  translationGroup,
  onTranslationGroupChange,
}: ArticleLanguageControlsProps) {
  const { data: config } = useQuery(settingsQueries.helpCenterConfig())
  const { locales } = helpCenterLocales(config as HelpCenterConfig | undefined)
  if (locales.length < 2 && locales.includes(locale as SupportedLocale)) return null

  const name = (l: string) => LOCALE_AUTONYMS[l as SupportedLocale] ?? l

  return (
    <div className="flex items-center gap-1.5">
      <Select value={locale} onValueChange={onLocaleChange}>
        <SelectTrigger
          size="sm"
          className="h-8 rounded-full text-xs px-3 min-w-0 max-w-[160px]"
          aria-label="Language"
        >
          <SelectValue>
            <span className="flex items-center gap-1.5 truncate">
              <LanguageIcon className="w-4 h-4 shrink-0" aria-hidden />
              <span className="truncate">{name(locale)}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          {locales.map((l) => (
            <SelectItem key={l} value={l}>
              {name(l)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="h-8 rounded-full border border-border/50 px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {translationGroup ? `Translations: ${translationGroup}` : 'Link translations'}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 space-y-2">
          <Label htmlFor="article-translation-group" className="text-sm font-medium">
            Translation key
          </Label>
          <Input
            id="article-translation-group"
            value={translationGroup}
            onChange={(e) => onTranslationGroupChange(e.target.value.trim().toLowerCase())}
            placeholder="getting-started"
          />
          <p className="text-xs text-muted-foreground">
            Give an article and its translations the same key, one article per language. Readers
            then switch between them, and see this one where their language has none.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  )
}
