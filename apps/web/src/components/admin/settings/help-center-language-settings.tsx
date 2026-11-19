import { useState } from 'react'
import { SettingsCard } from '@/components/admin/settings/settings-card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LOCALE_AUTONYMS, SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/shared/i18n'
import { helpCenterLocales } from '@/lib/shared/help-center-locale'
import type { HelpCenterConfig } from '@/lib/shared/types/settings'

interface HelpCenterLanguageSettingsProps {
  config: HelpCenterConfig
  disabled: boolean
  onSave: (data: { locales: string[]; defaultLocale: string }) => Promise<void>
}

/**
 * The languages help-center articles may be written in, and the default one.
 * Readers see their own language when it is on, the default otherwise, and a
 * language switcher whenever more than one is on.
 */
export function HelpCenterLanguageSettings({
  config,
  disabled,
  onSave,
}: HelpCenterLanguageSettingsProps) {
  const initial = helpCenterLocales(config)
  const [locales, setLocales] = useState<string[]>(initial.locales)
  const [defaultLocale, setDefaultLocale] = useState<string>(initial.defaultLocale)

  function toggle(locale: SupportedLocale, on: boolean) {
    if (!on && locale === defaultLocale) return
    const next = on ? [...locales, locale] : locales.filter((l) => l !== locale)
    const ordered = SUPPORTED_LOCALES.filter((l) => next.includes(l))
    setLocales(ordered)
    void onSave({ locales: ordered, defaultLocale })
  }

  function changeDefault(locale: string) {
    const next = locales.includes(locale) ? locales : [...locales, locale]
    setDefaultLocale(locale)
    setLocales(next)
    void onSave({ locales: next, defaultLocale: locale })
  }

  return (
    <SettingsCard
      title="Languages"
      description="Write articles in more than one language. Readers get their own language when it is on here, and the default language otherwise."
    >
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="hc-default-locale" className="text-sm font-medium">
            Default language
          </Label>
          <Select value={defaultLocale} onValueChange={changeDefault} disabled={disabled}>
            <SelectTrigger id="hc-default-locale" className="w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LOCALES.map((locale) => (
                <SelectItem key={locale} value={locale}>
                  {LOCALE_AUTONYMS[locale]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Shown when an article has no translation in the reader&apos;s language.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Languages</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SUPPORTED_LOCALES.map((locale) => {
              const id = `hc-locale-${locale}`
              const isDefault = locale === defaultLocale
              return (
                <div key={locale} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={locales.includes(locale)}
                    onCheckedChange={(checked) => toggle(locale, checked === true)}
                    disabled={disabled || isDefault}
                  />
                  <Label htmlFor={id} className="text-sm font-normal cursor-pointer">
                    {LOCALE_AUTONYMS[locale]}
                    {isDefault && <span className="ml-1 text-muted-foreground">(default)</span>}
                  </Label>
                </div>
              )
            })}
          </div>
        </fieldset>
      </div>
    </SettingsCard>
  )
}
