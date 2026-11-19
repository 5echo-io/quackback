import { createServerFn } from '@tanstack/react-start'
import { loadMessages, type SupportedLocale } from '@/lib/shared/i18n'

/**
 * Resolve the portal locale for the request: `?lang=`, then the locale cookie,
 * then the Accept-Language header (visitorLocaleForRequest).
 *
 * Shared by the standalone `/auth/*` routes so they render under the same
 * `PortalIntlProvider` the in-portal pages get from `_portal.tsx` — without
 * it `useIntl`/`<FormattedMessage>` in the auth forms would have no provider.
 */
export const getPortalLocaleFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { visitorLocaleForRequest } = await import('@/lib/server/visitor-locale')
  return visitorLocaleForRequest()
})

/**
 * Resolve the locale AND load its catalog for a route loader, so the page
 * renders translated during SSR (and hydrates from the same catalog) instead
 * of flashing English until the client fetches the messages.
 *
 * `loadMessages` runs wherever the loader runs: server-side during SSR, and
 * client-side (cached, code-split chunk) on client navigation — only the small
 * locale lookup is ever an RPC.
 */
export async function loadPortalIntl(): Promise<{
  locale: SupportedLocale
  messages: Record<string, string>
}> {
  const locale = await getPortalLocaleFn()
  const messages = await loadMessages(locale)
  return { locale, messages }
}
