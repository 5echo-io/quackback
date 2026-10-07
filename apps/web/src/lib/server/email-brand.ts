/**
 * What every email from this board wears: its name, its logo, and the primary
 * of its light theme. Registered with @quackback/email in server.ts; see
 * packages/email/src/brand.tsx for how the templates use it.
 *
 * Light, because an email is a white card whatever the reader's theme, and the
 * light primary is the one the theme chose to sit on white.
 */
import type { EmailBrand } from '@quackback/email'
import { db } from '@/lib/server/db'
import { parseJsonOrNull } from '@/lib/server/domains/settings/settings.helpers'
import type { BrandingConfig } from '@/lib/server/domains/settings/settings.types'
import { getEmailSafeUrl } from '@/lib/server/storage/s3'
import { oklchToHex } from '@/lib/shared/theme/colors'
import { computeContrastForeground } from '@/lib/shared/theme/expand'

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i
// oklchToHex only reads plain numbers, and answers #000000 for anything else —
// a percentage lightness would turn every button black rather than fail.
const PLAIN_OKLCH = /^oklch\(\s*[\d.]+\s+[\d.]+\s+[\d.]+\s*(?:\/\s*[\d.%]+\s*)?\)$/i

/** A theme colour as an email client can read it, or undefined. */
export function emailHex(value: string | undefined): string | undefined {
  const v = value?.trim()
  if (!v) return undefined
  if (HEX.test(v)) return v
  if (PLAIN_OKLCH.test(v)) return oklchToHex(v)
  return undefined
}

export async function getEmailBrand(): Promise<Partial<EmailBrand>> {
  const settings = await db.query.settings.findFirst({
    columns: { name: true, logoKey: true, brandingConfig: true },
  })
  if (!settings) return {}

  const primary = parseJsonOrNull<BrandingConfig>(settings.brandingConfig)?.light?.primary?.trim()

  return {
    name: settings.name,
    logoUrl: getEmailSafeUrl(settings.logoKey),
    primary: emailHex(primary),
    // The foreground the portal computes for the same primary. That reads
    // oklch only, so a hex primary leaves it to the email package's own
    // contrast check rather than taking the near-white it answers by default.
    primaryForeground:
      primary && PLAIN_OKLCH.test(primary)
        ? emailHex(computeContrastForeground(primary))
        : undefined,
  }
}
