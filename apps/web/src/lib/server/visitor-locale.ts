import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  normalizeLocale,
  resolveVisitorLocale,
  type SupportedLocale,
} from '@/lib/shared/i18n'

/**
 * The visitor's locale for the current request (see resolveVisitorLocale).
 *
 * A `?lang=` on the page's own URL is an explicit choice: it wins for this
 * request and is remembered in the locale cookie, so a link such as
 * `/hc?lang=nb` from another site keeps the visitor in Norwegian as they click
 * on. On a server-function call the request URL is the RPC's, which carries no
 * `lang`, and the cookie answers instead.
 */
export async function visitorLocaleForRequest(): Promise<SupportedLocale> {
  const { getRequestHeaders, getRequestUrl, setCookie } =
    await import('@tanstack/react-start/server')
  const headers = getRequestHeaders()

  const explicit = explicitLocale(getRequestUrl)
  if (explicit) {
    setCookie(LOCALE_COOKIE, explicit, {
      path: '/',
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: 'lax',
    })
  }

  return resolveVisitorLocale({
    explicit,
    cookieHeader: headers.get('cookie'),
    acceptLanguage: headers.get('accept-language'),
  })
}

/** The supported locale `?lang=` names on the request URL, if any. */
function explicitLocale(getRequestUrl: () => URL): SupportedLocale | null {
  try {
    const lang = getRequestUrl().searchParams.get('lang')
    return lang ? normalizeLocale(lang) : null
  } catch {
    return null
  }
}
