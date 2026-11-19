import { createFileRoute, notFound, Outlet } from '@tanstack/react-router'
import type { FeatureFlags, HelpCenterConfig } from '@/lib/shared/types/settings'
import { getHelpCenterLanguagesFn } from '@/lib/server/functions/help-center'
import { HelpCenterLanguageSwitcher } from '@/components/help-center/help-center-language-switcher'

export const Route = createFileRoute('/_portal/hc')({
  beforeLoad: ({ context }) => {
    const { settings } = context

    const flags = settings?.featureFlags as FeatureFlags | undefined
    if (!flags?.helpCenter) throw notFound()

    const helpCenterConfig = settings?.helpCenterConfig as HelpCenterConfig | undefined
    if (!helpCenterConfig?.enabled) throw notFound()
  },
  loader: async ({ context }) => {
    const { settings } = context
    const helpCenterConfig = (settings?.helpCenterConfig as HelpCenterConfig | null) ?? null
    const languages = await getHelpCenterLanguagesFn({ data: {} })
    return { helpCenterConfig, languages }
  },
  head: () => {
    return { meta: [] }
  },
  component: HelpCenterLayoutRoute,
})

function HelpCenterLayoutRoute() {
  const { languages } = Route.useLoaderData()
  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex-1 min-w-0">
        {languages.locales.length > 1 && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 flex justify-end">
            <HelpCenterLanguageSwitcher locales={languages.locales} current={languages.locale} />
          </div>
        )}
        <Outlet />
      </div>
    </div>
  )
}
