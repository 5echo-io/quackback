/**
 * Host-supplied colour override for the embedded widget.
 *
 * The board's theme is instance-wide (Settings > Branding), but one board can
 * sit inside many differently branded host pages. The host sends
 * `quackback:theme` with the colours of the page the widget is on — its
 * primary, and optionally its surfaces, in this board's own vocabulary — and
 * they land as inline custom properties on the iframe's <html>. An inline property
 * outranks both the `:root` and the `.dark` rule generateThemeCSS writes, so
 * one message re-colours light and dark alike — the host re-sends when its
 * own theme flips.
 *
 * Hex only. The values come from another document and end up in a style
 * attribute; a hex cannot carry url(), var() or a second declaration, so the
 * allowlist is the whole sanitiser. A key that is missing or fails it is
 * removed, which lets the instance theme show through again.
 *
 * The message can also carry the host's `mode`, light or dark. The board
 * resolves `system` from the frame's own `prefers-color-scheme`, which is the
 * OS's — setting `color-scheme` on the iframe element does not reach it from a
 * cross-origin parent — so a host in light mode on a dark OS got a dark widget.
 * The mode goes straight onto <html> rather than through next-themes'
 * `setTheme`: that one persists, in localStorage and in the theme cookie, and
 * a page that embeds the widget has no business choosing the theme the same
 * person gets on the portal.
 */

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

export interface HostTheme {
  /** Fill for primary buttons, the vote button, active tabs and links. */
  primary?: string
  /** Text drawn on top of `primary`. */
  primaryForeground?: string
  /** The page behind everything. */
  background?: string
  /** Body text, and text on every surface below. */
  foreground?: string
  /** Cards, popovers and menus. */
  card?: string
  /** Quiet fills: hovers, chips, the selected row, secondary buttons. */
  muted?: string
  /** Secondary text — the most used colour in the widget after the body. */
  mutedForeground?: string
  /** Hairlines and input outlines. */
  border?: string
  /** The host page's light/dark. Absent leaves the widget's own theme alone. */
  mode?: HostMode
}

export type HostMode = 'light' | 'dark'

// `--ring` follows the primary, as it does in expandTheme when the admin has
// not set one, so focus rings match the buttons they surround. The surfaces
// fan out the same way: the host names one colour per role, and each role
// covers the shadcn tokens that play it here (`--accent` is shadcn's hover
// fill, not a brand colour).
const PROPERTIES: Record<Exclude<keyof HostTheme, 'mode'>, string[]> = {
  primary: ['--primary', '--ring'],
  primaryForeground: ['--primary-foreground'],
  background: ['--background'],
  foreground: [
    '--foreground',
    '--card-foreground',
    '--popover-foreground',
    '--secondary-foreground',
    '--accent-foreground',
  ],
  card: ['--card', '--popover'],
  muted: ['--muted', '--secondary', '--accent'],
  mutedForeground: ['--muted-foreground'],
  border: ['--border', '--input'],
}

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value)
}

export function isHostMode(value: unknown): value is HostMode {
  return value === 'light' || value === 'dark'
}

/** Apply (or, for missing and invalid keys, clear) the host's colours and mode. */
export function applyHostTheme(data: unknown, root: HTMLElement = document.documentElement): void {
  const theme = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  for (const key of Object.keys(PROPERTIES) as (keyof typeof PROPERTIES)[]) {
    const value = theme[key]
    for (const property of PROPERTIES[key]) {
      if (isHexColor(value)) root.style.setProperty(property, value)
      else root.style.removeProperty(property)
    }
  }
  applyHostMode(theme.mode, root)
}

const MODE_CLASSES = ['light', 'dark', 'system']
const modeGuards = new WeakMap<HTMLElement, MutationObserver>()

/**
 * Pin <html> to the host's mode, or stop pinning it.
 *
 * next-themes still owns the class and re-applies its own choice when the OS
 * preference changes under `system`, so the pin is held by an observer on the
 * class attribute. It writes only when the class has drifted, which is also
 * what keeps it from answering its own mutation. A missing or unknown mode
 * releases the pin and changes nothing: the theme stays where it is until
 * next-themes next decides, which is what a host that never sent a mode got.
 */
export function applyHostMode(value: unknown, root: HTMLElement = document.documentElement): void {
  modeGuards.get(root)?.disconnect()
  modeGuards.delete(root)
  if (!isHostMode(value)) return

  const pin = () => {
    const drifted = MODE_CLASSES.some((c) => root.classList.contains(c) !== (c === value))
    if (!drifted && root.style.colorScheme === value) return
    root.classList.remove(...MODE_CLASSES)
    root.classList.add(value)
    root.style.colorScheme = value
  }
  pin()
  const guard = new MutationObserver(pin)
  guard.observe(root, { attributes: true, attributeFilter: ['class'] })
  modeGuards.set(root, guard)
}
