/**
 * Host-supplied colour override for the embedded widget.
 *
 * The board's theme is instance-wide (Settings > Branding), but one board can
 * sit inside many differently branded host pages. The host sends
 * `quackback:theme` with the colours of the page the widget is on, and they
 * land as inline custom properties on the iframe's <html>. An inline property
 * outranks both the `:root` and the `.dark` rule generateThemeCSS writes, so
 * one message re-colours light and dark alike — the host re-sends when its
 * own theme flips.
 *
 * Hex only. The values come from another document and end up in a style
 * attribute; a hex cannot carry url(), var() or a second declaration, so the
 * allowlist is the whole sanitiser. A key that is missing or fails it is
 * removed, which lets the instance theme show through again.
 */

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

export interface HostTheme {
  /** Fill for primary buttons, the vote button, active tabs and links. */
  primary?: string
  /** Text drawn on top of `primary`. */
  primaryForeground?: string
}

// `--ring` follows the primary, as it does in expandTheme when the admin has
// not set one, so focus rings match the buttons they surround.
const PROPERTIES: Record<keyof HostTheme, string[]> = {
  primary: ['--primary', '--ring'],
  primaryForeground: ['--primary-foreground'],
}

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value)
}

/** Apply (or, for missing and invalid keys, clear) the host's colours. */
export function applyHostTheme(data: unknown, root: HTMLElement = document.documentElement): void {
  const theme = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  for (const key of Object.keys(PROPERTIES) as (keyof HostTheme)[]) {
    const value = theme[key]
    for (const property of PROPERTIES[key]) {
      if (isHexColor(value)) root.style.setProperty(property, value)
      else root.style.removeProperty(property)
    }
  }
}
