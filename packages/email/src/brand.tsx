/**
 * The board's own brand, for every email it sends.
 *
 * Emails used to wear Quackback's: its yellow on every button, its logo when
 * the board had none, and its name in subjects and headings. A board run by
 * somebody else is theirs, so the colour, the name and the logo come from the
 * instance's settings instead.
 *
 * The brand is instance-wide, not per recipient, so it is resolved once per
 * send rather than threaded through every `send*Email` call: the app registers
 * a resolver at startup (`configureEmailBrand`), `sendEmail` asks it, and the
 * templates read the answer from context through the components in
 * `templates/brand-elements.tsx`. Nothing registered, or a resolver that
 * throws, gives `DEFAULT_BRAND` — neutral, and never the vendor's.
 */
import { createContext, useContext, type ReactNode } from 'react'

export interface EmailBrand {
  /** Buttons, links and accent bars. Hex. */
  primary: string
  /** Text drawn on `primary`. Hex. */
  primaryForeground: string
  /** The board's name, for headings and the logo's place when there is no logo. */
  name?: string
  /** An absolute URL an email client can fetch. */
  logoUrl?: string | null
}

export const DEFAULT_BRAND: EmailBrand = {
  primary: '#16181d',
  primaryForeground: '#ffffff',
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/** Keep what is usable and fall back field by field; colours are hex or nothing. */
export function sanitizeBrand(input: Partial<EmailBrand> | null | undefined): EmailBrand {
  const brand: EmailBrand = { ...DEFAULT_BRAND }
  if (!input) return brand
  if (typeof input.primary === 'string' && HEX.test(input.primary)) {
    brand.primary = input.primary
    // A foreground is only meaningful against the primary it was chosen for.
    brand.primaryForeground =
      typeof input.primaryForeground === 'string' && HEX.test(input.primaryForeground)
        ? input.primaryForeground
        : readableOn(input.primary)
  }
  if (typeof input.name === 'string' && input.name.trim()) brand.name = input.name.trim()
  if (typeof input.logoUrl === 'string' && /^https?:\/\//.test(input.logoUrl)) {
    brand.logoUrl = input.logoUrl
  }
  return brand
}

type BrandResolver = () => Promise<Partial<EmailBrand> | null | undefined>
let resolver: BrandResolver | null = null

/** Register where the brand comes from. Called once, by the app, at startup. */
export function configureEmailBrand(fn: BrandResolver | null): void {
  resolver = fn
}

/** The brand for the email about to be sent. Never throws. */
export async function resolveEmailBrand(): Promise<EmailBrand> {
  if (!resolver) return { ...DEFAULT_BRAND }
  try {
    return sanitizeBrand(await resolver())
  } catch {
    return { ...DEFAULT_BRAND }
  }
}

const BrandContext = createContext<EmailBrand>(DEFAULT_BRAND)

export function EmailBrandProvider({
  brand,
  children,
}: {
  brand: EmailBrand
  children: ReactNode
}) {
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>
}

export function useEmailBrand(): EmailBrand {
  return useContext(BrandContext)
}

// ---- Contrast ---------------------------------------------------------------

function channel(hex: string, i: number): number {
  const full =
    hex.length === 4
      ? hex
          .slice(1)
          .split('')
          .map((c) => c + c)
          .join('')
      : hex.slice(1)
  const v = parseInt(full.slice(i * 2, i * 2 + 2), 16) / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2)
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** White or near-black, whichever reads on `bg`. */
export function readableOn(bg: string): string {
  return contrast(bg, '#ffffff') >= contrast(bg, '#16181d') ? '#ffffff' : '#16181d'
}

/**
 * The colour for a text link on white. A brand chosen for buttons can be far
 * too light to read as text — a yellow fill is fine behind dark text, and
 * illegible as a link — so below AA it falls back to the body text colour.
 */
export function linkColor(brand: EmailBrand, text = '#16181d'): string {
  return contrast(brand.primary, '#ffffff') >= 4.5 ? brand.primary : text
}
